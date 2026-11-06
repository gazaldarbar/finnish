package app.finnish.writer;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FinnishPrintPlugin.class);
        super.onCreate(savedInstanceState);
        FinnishPrintPlugin.handleIntent(this, getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        FinnishPrintPlugin.handleIntent(this, intent);
    }
}
