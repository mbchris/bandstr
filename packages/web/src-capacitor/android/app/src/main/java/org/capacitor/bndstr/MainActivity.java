package org.capacitor.bandstr;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import org.capacitor.bandstr.playbilling.PlayBillingPlugin;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(PlayBillingPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
