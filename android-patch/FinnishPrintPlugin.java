package app.finnish.writer;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.OpenableColumns;
import android.view.ViewGroup;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import androidx.activity.result.ActivityResult;
import androidx.webkit.WebViewAssetLoader;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/** Print-to-PDF, "Save as" dialog and "Open with finnish" support. Creator: Nishan */
@CapacitorPlugin(name = "FinnishPrint")
public class FinnishPrintPlugin extends Plugin {
    private static final String ASSET_BASE = "https://appassets.androidplatform.net/assets/public/";
    private WebView printView;
    static String pendingName, pendingText;

    /* ---------------------------------------------------------- open files from other apps ("Open with") */
    public static void handleIntent(Context ctx, Intent i) {
        if (i == null || i.getData() == null) return;
        String a = i.getAction();
        if (!Intent.ACTION_VIEW.equals(a) && !Intent.ACTION_EDIT.equals(a)) return;
        Uri u = i.getData();
        try (InputStream is = ctx.getContentResolver().openInputStream(u)) {
            ByteArrayOutputStream bo = new ByteArrayOutputStream();
            byte[] buf = new byte[8192]; int n;
            while ((n = is.read(buf)) > 0) bo.write(buf, 0, n);
            String name = null;
            try (Cursor c = ctx.getContentResolver().query(u, null, null, null, null)) {
                if (c != null && c.moveToFirst()) { int ix = c.getColumnIndex(OpenableColumns.DISPLAY_NAME); if (ix >= 0) name = c.getString(ix); }
            } catch (Exception ignored) { }
            if (name == null) { String p = u.getLastPathSegment(); name = p == null ? "script.finnish" : p; }
            pendingName = name;
            pendingText = bo.toString("UTF-8");
        } catch (Exception ignored) { }
    }

    @PluginMethod
    public void getPending(PluginCall call) {
        JSObject o = new JSObject();
        if (pendingText != null) { o.put("name", pendingName); o.put("text", pendingText); }
        pendingText = null; pendingName = null;
        call.resolve(o);
    }

    /* ---------------------------------------------------------- print / save as PDF */
    @PluginMethod
    public void print(final PluginCall call) {
        final String html0 = call.getString("html", "");
        final String name = call.getString("name", "script");
        final boolean letter = "letter".equals(call.getString("paper", "a4"));
        final String html = html0.replace("<base href=\"https://localhost/\">", "<base href=\"" + ASSET_BASE + "\">");
        getActivity().runOnUiThread(() -> {
            try {
                final Activity act = getActivity();
                final ViewGroup root = (ViewGroup) act.getWindow().getDecorView();
                if (printView != null) { root.removeView(printView); printView.destroy(); printView = null; }
                final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                        .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(getContext())).build();
                final WebView wv = new WebView(act);
                printView = wv;
                wv.setAlpha(0.01f);
                root.addView(wv, new FrameLayout.LayoutParams(2, 2)); // must be attached to a window to render and print
                final boolean[] done = { false };
                final Runnable go = () -> {
                    if (done[0]) return;
                    done[0] = true;
                    try {
                        PrintManager pm = (PrintManager) act.getSystemService(Context.PRINT_SERVICE);
                        PrintDocumentAdapter adapter = wv.createPrintDocumentAdapter(name);
                        PrintAttributes attrs = new PrintAttributes.Builder()
                                .setMediaSize(letter ? PrintAttributes.MediaSize.NA_LETTER : PrintAttributes.MediaSize.ISO_A4)
                                .setMinMargins(PrintAttributes.Margins.NO_MARGINS).build();
                        pm.print(name, adapter, attrs);
                        call.resolve(new JSObject());
                    } catch (Exception e) { call.reject("Print failed: " + e.getMessage()); }
                };
                wv.setWebViewClient(new WebViewClient() {
                    @Override
                    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                        return loader.shouldInterceptRequest(request.getUrl());
                    }

                    @Override
                    public void onPageFinished(WebView view, String url) {
                        new Handler(Looper.getMainLooper()).postDelayed(go, 900);
                    }
                });
                new Handler(Looper.getMainLooper()).postDelayed(go, 7000); // safety net if the page never reports "finished"
                wv.loadDataWithBaseURL(ASSET_BASE, html, "text/html", "UTF-8", null);
            } catch (Exception e) { call.reject("Print failed: " + e.getMessage()); }
        });
    }

    /* ---------------------------------------------------------- system "Save as" dialog */
    @PluginMethod
    public void saveFile(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType(call.getString("mime", "application/octet-stream"));
        i.putExtra(Intent.EXTRA_TITLE, call.getString("name", "file"));
        startActivityForResult(call, i, "saveResult");
    }

    @ActivityCallback
    private void saveResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) { call.reject("cancelled"); return; }
        Uri uri = result.getData().getData();
        try (OutputStream os = getContext().getContentResolver().openOutputStream(uri, "wt")) {
            os.write(call.getString("data", "").getBytes("UTF-8"));
            JSObject o = new JSObject(); o.put("uri", uri.toString()); call.resolve(o);
        } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
    }
}
