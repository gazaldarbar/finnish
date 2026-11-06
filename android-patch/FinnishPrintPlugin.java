package app.finnish.writer;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.webkit.WebViewAssetLoader;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Prints the script HTML through Android's print system, where "Save as PDF" is built in. Creator: Nishan */
@CapacitorPlugin(name = "FinnishPrint")
public class FinnishPrintPlugin extends Plugin {
    private static final String ASSET_BASE = "https://appassets.androidplatform.net/assets/public/";
    private WebView printView;

    @PluginMethod
    public void print(final PluginCall call) {
        final String html0 = call.getString("html", "");
        final String name = call.getString("name", "script");
        final String html = html0.replace("<base href=\"https://localhost/\">", "<base href=\"" + ASSET_BASE + "\">");
        getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                        .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(getContext())).build();
                printView = new WebView(getContext());
                printView.getSettings().setAllowFileAccess(false);
                printView.setWebViewClient(new WebViewClient() {
                    @Override
                    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                        return loader.shouldInterceptRequest(request.getUrl());
                    }

                    @Override
                    public void onPageFinished(final WebView view, String url) {
                        view.postDelayed(new Runnable() {
                            @Override
                            public void run() {
                                PrintManager pm = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                                PrintDocumentAdapter adapter = view.createPrintDocumentAdapter(name);
                                pm.print(name, adapter, new PrintAttributes.Builder().build());
                                call.resolve(new JSObject());
                            }
                        }, 900);
                    }
                });
                printView.loadDataWithBaseURL(ASSET_BASE, html, "text/html", "UTF-8", null);
            }
        });
    }
}
