import Foundation
import Capacitor
import StoreKit
import UIKit

@objc(AppStoreBillingPlugin)
public class AppStoreBillingPlugin: CAPPlugin, CAPBridgedPlugin, SKProductsRequestDelegate, SKPaymentTransactionObserver {
    public let identifier = "AppStoreBillingPlugin"
    public let jsName = "AppStoreBilling"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "initialize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "querySubscriptions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchaseSubscription", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restoreSubscriptions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openAppStoreSubscriptions", returnType: CAPPluginReturnPromise),
    ]

    private var cachedProducts: [String: SKProduct] = [:]
    private var productsRequest: SKProductsRequest?
    private var pendingQueryCall: CAPPluginCall?
    private var pendingPurchaseCall: CAPPluginCall?
    private var pendingRestoreCall: CAPPluginCall?
    private var restoredPurchases: [[String: Any]] = []

    public override func load() {
        SKPaymentQueue.default().add(self)
    }

    deinit {
        SKPaymentQueue.default().remove(self)
    }

    @objc func initialize(_ call: CAPPluginCall) {
        guard SKPaymentQueue.canMakePayments() else {
            call.reject("In-app purchases are disabled for this device/account.")
            return
        }
        call.resolve(["ready": true])
    }

    @objc func querySubscriptions(_ call: CAPPluginCall) {
        guard pendingQueryCall == nil else {
            call.reject("A product query is already in progress.")
            return
        }

        let ids = (call.getArray("productIds") ?? [])
            .compactMap { $0 as? String }
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }

        guard !ids.isEmpty else {
            call.reject("productIds must not be empty")
            return
        }

        pendingQueryCall = call
        let request = SKProductsRequest(productIdentifiers: Set(ids))
        productsRequest = request
        request.delegate = self
        request.start()
    }

    @objc func purchaseSubscription(_ call: CAPPluginCall) {
        guard pendingPurchaseCall == nil else {
            call.reject("A purchase is already in progress.")
            return
        }

        guard let productId = call.getString("productId")?.trimmingCharacters(in: .whitespacesAndNewlines), !productId.isEmpty else {
            call.reject("productId is required")
            return
        }

        guard let product = cachedProducts[productId] else {
            call.reject("Product not loaded. Call querySubscriptions first.")
            return
        }

        pendingPurchaseCall = call
        SKPaymentQueue.default().add(SKPayment(product: product))
    }

    @objc func restoreSubscriptions(_ call: CAPPluginCall) {
        guard pendingRestoreCall == nil else {
            call.reject("Restore is already in progress.")
            return
        }

        restoredPurchases = []
        pendingRestoreCall = call
        SKPaymentQueue.default().restoreCompletedTransactions()
    }

    @objc func openAppStoreSubscriptions(_ call: CAPPluginCall) {
        guard let url = URL(string: "https://apps.apple.com/account/subscriptions") else {
            call.reject("Unable to construct subscriptions URL.")
            return
        }

        DispatchQueue.main.async {
            UIApplication.shared.open(url, options: [:]) { opened in
                if opened {
                    call.resolve()
                } else {
                    call.reject("Unable to open App Store subscriptions.")
                }
            }
        }
    }

    public func productsRequest(_ request: SKProductsRequest, didReceive response: SKProductsResponse) {
        guard let call = pendingQueryCall else { return }
        pendingQueryCall = nil
        productsRequest = nil

        cachedProducts.removeAll()
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency

        let items: [[String: Any]] = response.products.map { product in
            cachedProducts[product.productIdentifier] = product
            formatter.locale = product.priceLocale
            let price = formatter.string(from: product.price)
            let offer: [String: Any?] = [
                "basePlanId": NSNull(),
                "offerId": NSNull(),
                "offerToken": product.productIdentifier,
                "formattedPrice": price ?? NSNull(),
                "billingPeriod": NSNull(),
            ]

            return [
                "productId": product.productIdentifier,
                "title": product.localizedTitle,
                "description": product.localizedDescription,
                "offers": [offer.compactMapValues { $0 }],
            ]
        }

        call.resolve(["items": items])
    }

    public func request(_ request: SKRequest, didFailWithError error: Error) {
        if let call = pendingQueryCall {
            pendingQueryCall = nil
            productsRequest = nil
            call.reject("Product query failed: \(error.localizedDescription)")
        }
    }

    public func paymentQueue(_ queue: SKPaymentQueue, updatedTransactions transactions: [SKPaymentTransaction]) {
        for transaction in transactions {
            switch transaction.transactionState {
            case .purchased:
                handlePurchased(transaction)
            case .failed:
                handleFailed(transaction)
            case .restored:
                handleRestored(transaction)
            case .deferred, .purchasing:
                break
            @unknown default:
                break
            }
        }
    }

    public func paymentQueueRestoreCompletedTransactionsFinished(_ queue: SKPaymentQueue) {
        guard let call = pendingRestoreCall else { return }
        pendingRestoreCall = nil
        call.resolve(["purchases": restoredPurchases])
    }

    public func paymentQueue(_ queue: SKPaymentQueue, restoreCompletedTransactionsFailedWithError error: Error) {
        guard let call = pendingRestoreCall else { return }
        pendingRestoreCall = nil
        call.reject("Restore failed: \(error.localizedDescription)")
    }

    private func handlePurchased(_ transaction: SKPaymentTransaction) {
        if let call = pendingPurchaseCall {
            pendingPurchaseCall = nil
            call.resolve(["purchase": toPurchaseObject(transaction)])
        }
        SKPaymentQueue.default().finishTransaction(transaction)
    }

    private func handleFailed(_ transaction: SKPaymentTransaction) {
        if let call = pendingPurchaseCall {
            pendingPurchaseCall = nil
            let err = transaction.error?.localizedDescription ?? "Unknown purchase error."
            call.reject("Purchase failed: \(err)")
        }
        SKPaymentQueue.default().finishTransaction(transaction)
    }

    private func handleRestored(_ transaction: SKPaymentTransaction) {
        if pendingRestoreCall != nil {
            restoredPurchases.append(toPurchaseObject(transaction))
        }
        SKPaymentQueue.default().finishTransaction(transaction)
    }

    private func toPurchaseObject(_ transaction: SKPaymentTransaction) -> [String: Any] {
        let txId = transaction.transactionIdentifier
        let originalTxId = transaction.original?.transactionIdentifier
        let purchaseToken = originalTxId ?? txId ?? UUID().uuidString

        return [
            "orderId": txId ?? NSNull(),
            "purchaseToken": purchaseToken,
            "acknowledged": true,
            "purchaseState": 1,
            "products": [transaction.payment.productIdentifier],
        ]
    }
}
