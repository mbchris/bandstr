package org.capacitor.bandstr.playbilling;

import android.content.Intent;
import android.net.Uri;

import androidx.annotation.NonNull;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.AcknowledgePurchaseResponseListener;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesResponseListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryProductDetailsResult;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@CapacitorPlugin(name = "PlayBilling")
public class PlayBillingPlugin extends Plugin implements com.android.billingclient.api.PurchasesUpdatedListener {
  private BillingClient billingClient;
  private final Map<String, ProductDetails> cachedProducts = new HashMap<>();
  private PluginCall pendingPurchaseCall;

  @Override
  public void load() {
    super.load();
    billingClient = BillingClient.newBuilder(getContext())
      .setListener(this)
      .enablePendingPurchases(
        PendingPurchasesParams.newBuilder()
          .enableOneTimeProducts()
          .build()
      )
      .build();
  }

  @PluginMethod
  public void initialize(PluginCall call) {
    ensureBillingConnection(call);
  }

  @PluginMethod
  public void querySubscriptions(PluginCall call) {
    JSArray productIds = call.getArray("productIds", new JSArray());
    if (productIds.length() == 0) {
      call.reject("productIds must not be empty");
      return;
    }

    ensureBillingConnection(
      call,
      () -> {
        List<QueryProductDetailsParams.Product> products = new ArrayList<>();
        for (int i = 0; i < productIds.length(); i++) {
          String productId = productIds.optString(i, null);
          if (productId == null || productId.trim().isEmpty()) continue;
          products.add(
            QueryProductDetailsParams.Product.newBuilder()
              .setProductId(productId)
              .setProductType(BillingClient.ProductType.SUBS)
              .build()
          );
        }

        if (products.isEmpty()) {
          call.reject("No valid productIds provided");
          return;
        }

        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
          .setProductList(products)
          .build();

        billingClient.queryProductDetailsAsync(
          params,
          (billingResult, productDetailsResult) -> {
            if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
              call.reject("queryProductDetailsAsync failed: " + billingResult.getDebugMessage());
              return;
            }

            cachedProducts.clear();
            JSArray items = new JSArray();
            List<ProductDetails> productDetailsList =
              productDetailsResult != null ? productDetailsResult.getProductDetailsList() : null;
            if (productDetailsList != null) {
              for (ProductDetails details : productDetailsList) {
                cachedProducts.put(details.getProductId(), details);
                JSObject base = new JSObject();
                base.put("productId", details.getProductId());
                base.put("title", details.getTitle());
                base.put("description", details.getDescription());

              JSArray offers = new JSArray();
              List<ProductDetails.SubscriptionOfferDetails> offerDetails = details.getSubscriptionOfferDetails();
              if (offerDetails != null) {
                for (ProductDetails.SubscriptionOfferDetails offer : offerDetails) {
                  JSObject offerItem = new JSObject();
                  offerItem.put("basePlanId", offer.getBasePlanId());
                  offerItem.put("offerId", offer.getOfferId());
                  offerItem.put("offerToken", offer.getOfferToken());

                  String formattedPrice = null;
                  String billingPeriod = null;
                  List<ProductDetails.PricingPhase> phases = offer.getPricingPhases().getPricingPhaseList();
                  if (!phases.isEmpty()) {
                    ProductDetails.PricingPhase lastPhase = phases.get(phases.size() - 1);
                    formattedPrice = lastPhase.getFormattedPrice();
                    billingPeriod = lastPhase.getBillingPeriod();
                  }
                  offerItem.put("formattedPrice", formattedPrice);
                  offerItem.put("billingPeriod", billingPeriod);
                  offers.put(offerItem);
                }
              }

              base.put("offers", offers);
              items.put(base);
            }
          }
          JSObject ret = new JSObject();
          ret.put("items", items);
          call.resolve(ret);
        }
      );
      }
    );
  }

  @PluginMethod
  public void purchaseSubscription(PluginCall call) {
    String productId = call.getString("productId");
    String offerToken = call.getString("offerToken");
    if (productId == null || productId.trim().isEmpty()) {
      call.reject("productId is required");
      return;
    }

    ProductDetails details = cachedProducts.get(productId);
    if (details == null) {
      call.reject("Product not loaded. Call querySubscriptions first.");
      return;
    }

    ensureBillingConnection(
      call,
      () -> {
        BillingFlowParams.ProductDetailsParams.Builder productBuilder =
          BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(details);
        if (offerToken != null && !offerToken.trim().isEmpty()) {
          productBuilder.setOfferToken(offerToken);
        }

        List<BillingFlowParams.ProductDetailsParams> detailParams = new ArrayList<>();
        detailParams.add(productBuilder.build());

        BillingFlowParams flowParams = BillingFlowParams.newBuilder()
          .setProductDetailsParamsList(detailParams)
          .build();

        BillingResult result = billingClient.launchBillingFlow(getActivity(), flowParams);
        if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
          call.reject("launchBillingFlow failed: " + result.getDebugMessage());
          return;
        }

        pendingPurchaseCall = call;
      }
    );
  }

  @PluginMethod
  public void restoreSubscriptions(PluginCall call) {
    ensureBillingConnection(
      call,
      () -> billingClient.queryPurchasesAsync(
        QueryPurchasesParams.newBuilder()
          .setProductType(BillingClient.ProductType.SUBS)
          .build(),
        new PurchasesResponseListener() {
          @Override
          public void onQueryPurchasesResponse(@NonNull BillingResult billingResult, @NonNull List<Purchase> purchases) {
            if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
              call.reject("queryPurchasesAsync failed: " + billingResult.getDebugMessage());
              return;
            }

            JSArray restored = new JSArray();
            for (Purchase purchase : purchases) {
              restored.put(toPurchaseObject(purchase));
            }
            JSObject ret = new JSObject();
            ret.put("purchases", restored);
            call.resolve(ret);
          }
        }
      )
    );
  }

  @PluginMethod
  public void openPlaySubscriptions(PluginCall call) {
    try {
      Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/account/subscriptions"));
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      getContext().startActivity(intent);
      call.resolve();
    } catch (Exception ex) {
      call.reject("Unable to open Play subscriptions: " + ex.getMessage());
    }
  }

  @Override
  public void onPurchasesUpdated(@NonNull BillingResult billingResult, List<Purchase> purchases) {
    if (pendingPurchaseCall == null) return;

    if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null && !purchases.isEmpty()) {
      Purchase purchase = purchases.get(0);
      acknowledgeIfNeeded(purchase);
      JSObject ret = new JSObject();
      ret.put("purchase", toPurchaseObject(purchase));
      pendingPurchaseCall.resolve(ret);
      pendingPurchaseCall = null;
      return;
    }

    if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
      resolveWithExistingSubscriptionPurchase(
        "Purchase already owned, but no active subscription purchase was found"
      );
      return;
    }

    if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
      resolveWithExistingSubscriptionPurchase("Purchase result did not include a purchase token");
      return;
    }

    if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) {
      pendingPurchaseCall.reject("Purchase canceled by user");
    } else {
      pendingPurchaseCall.reject("Purchase failed: " + billingResult.getDebugMessage());
    }
    pendingPurchaseCall = null;
  }

  private void resolveWithExistingSubscriptionPurchase(String fallbackError) {
    billingClient.queryPurchasesAsync(
      QueryPurchasesParams.newBuilder()
        .setProductType(BillingClient.ProductType.SUBS)
        .build(),
      new PurchasesResponseListener() {
        @Override
        public void onQueryPurchasesResponse(@NonNull BillingResult billingResult, @NonNull List<Purchase> purchases) {
          if (pendingPurchaseCall == null) return;

          if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK && !purchases.isEmpty()) {
            Purchase purchase = purchases.get(0);
            acknowledgeIfNeeded(purchase);
            JSObject ret = new JSObject();
            ret.put("purchase", toPurchaseObject(purchase));
            pendingPurchaseCall.resolve(ret);
          } else if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
            pendingPurchaseCall.reject(fallbackError);
          } else {
            pendingPurchaseCall.reject("Failed to query existing purchases: " + billingResult.getDebugMessage());
          }
          pendingPurchaseCall = null;
        }
      }
    );
  }

  private void acknowledgeIfNeeded(Purchase purchase) {
    if (purchase.isAcknowledged()) return;
    AcknowledgePurchaseParams params = AcknowledgePurchaseParams.newBuilder()
      .setPurchaseToken(purchase.getPurchaseToken())
      .build();
    billingClient.acknowledgePurchase(
      params,
      new AcknowledgePurchaseResponseListener() {
        @Override
        public void onAcknowledgePurchaseResponse(@NonNull BillingResult billingResult) {
          // Intentionally ignored here; purchase data is still returned to JS.
        }
      }
    );
  }

  private JSObject toPurchaseObject(Purchase purchase) {
    JSObject obj = new JSObject();
    obj.put("orderId", purchase.getOrderId());
    obj.put("purchaseToken", purchase.getPurchaseToken());
    obj.put("acknowledged", purchase.isAcknowledged());
    obj.put("purchaseState", purchase.getPurchaseState());

    JSArray productIds = new JSArray();
    List<String> products = purchase.getProducts();
    for (String p : products) productIds.put(p);
    obj.put("products", productIds);
    return obj;
  }

  private void ensureBillingConnection(PluginCall call) {
    ensureBillingConnection(call, () -> {
      JSObject ret = new JSObject();
      ret.put("ready", true);
      call.resolve(ret);
    });
  }

  private void ensureBillingConnection(PluginCall call, Runnable onReady) {
    if (billingClient == null) {
      call.reject("Billing client is not initialized");
      return;
    }

    if (billingClient.isReady()) {
      onReady.run();
      return;
    }

    billingClient.startConnection(
      new BillingClientStateListener() {
        @Override
        public void onBillingSetupFinished(@NonNull BillingResult billingResult) {
          if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
            onReady.run();
          } else {
            call.reject("Billing setup failed: " + billingResult.getDebugMessage());
          }
        }

        @Override
        public void onBillingServiceDisconnected() {
          // Next call re-connects.
        }
      }
    );
  }
}
