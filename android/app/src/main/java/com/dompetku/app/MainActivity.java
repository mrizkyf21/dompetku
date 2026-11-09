package com.dompetku.app;

import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.SystemClock;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.activity.EdgeToEdge;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.fragment.app.FragmentActivity;
import androidx.webkit.WebViewAssetLoader;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.Arrays;

/**
 * Membungkus aplikasi web Dompetku dalam WebView.
 *
 * File web dilayani dari assets lewat alamat https://appassets.androidplatform.net, sehingga
 * localStorage dan fetch ke Gemini berjalan seperti di browser biasa. Hal yang tidak tersedia di
 * WebView (pilih/ambil foto, simpan ke Download, menu Share, tombol Kembali) ditangani di sini,
 * begitu juga kunci aplikasi dengan sidik jari / PIN HP.
 */
public class MainActivity extends FragmentActivity {

    private static final String HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + HOST + "/assets/www/index.html";

    /** Sidik jari/wajah, atau PIN/pola/sandi layar HP sebagai cadangan. */
    private static final int AUTHENTICATORS =
            BiometricManager.Authenticators.BIOMETRIC_WEAK | BiometricManager.Authenticators.DEVICE_CREDENTIAL;
    /** Kunci lagi bila aplikasi ditinggal selama ini. */
    private static final long LOCK_AFTER_MS = 60_000;
    /** Saat memotret struk / memilih file / berbagi, aplikasi baru dikunci setelah ditinggal selama ini. */
    private static final long LOCK_AFTER_OWN_INTENT_MS = 10 * 60_000;
    private static final String PREFS = "dompetku";
    private static final String PREF_LOCK = "lock_enabled";

    // Disimpan per proses: rotasi layar / ganti tema tidak mengunci ulang, tapi aplikasi yang
    // ditutup sistem selalu mulai dalam keadaan terkunci.
    private static boolean unlocked;
    private static long backgroundSince;
    private static boolean ownIntentPending;

    private enum LockAction { UNLOCK, ENABLE, DISABLE }

    private WebView webView;
    private View statusBg;
    private View navBg;
    private View lockScreen;
    private TextView lockMessage;
    private SharedPreferences prefs;
    private BiometricPrompt biometricPrompt;
    private LockAction pendingAction;
    private boolean authInProgress;

    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraUri;
    private ActivityResultLauncher<Intent> pickLauncher;
    private ActivityResultLauncher<Uri> cameraLauncher;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        EdgeToEdge.enable(this);
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.web);
        statusBg = findViewById(R.id.statusBg);
        navBg = findViewById(R.id.navBg);
        lockScreen = findViewById(R.id.lockScreen);
        lockMessage = findViewById(R.id.lockMessage);
        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        applyInsets();
        registerFileLaunchers();
        setUpLock();

        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            // Bisa diperiksa dari chrome://inspect di komputer
            WebView.setWebContentsDebuggingEnabled(true);
        }

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);

        WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .setDomain(HOST)
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (HOST.equals(url.getHost())) return false;
                // Tautan ke luar (mis. halaman API key Gemini) dibuka di browser
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, url));
                } catch (ActivityNotFoundException ignored) {
                }
                return true;
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                return openFileChooser(callback, params);
            }
        });
        webView.addJavascriptInterface(new Bridge(), "DompetkuAndroid");

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (lockScreen.getVisibility() == View.VISIBLE) {
                    finish();
                    return;
                }
                // Halaman menutup dialog atau kembali ke Beranda dulu; baru keluar jika sudah di Beranda
                webView.evaluateJavascript("window.dompetkuBack ? window.dompetkuBack() : false", (handled) -> {
                    if (!"true".equals(handled)) {
                        setEnabled(false);
                        getOnBackPressedDispatcher().onBackPressed();
                        setEnabled(true);
                    }
                });
            }
        });

        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) {
            webView.loadUrl(START_URL);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    protected void onDestroy() {
        webView.destroy();
        super.onDestroy();
    }

    // ---------- Kunci aplikasi (sidik jari / PIN HP) ----------

    private void setUpLock() {
        biometricPrompt = new BiometricPrompt(this, ContextCompat.getMainExecutor(this),
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                        authInProgress = false;
                        onAuthSucceeded();
                    }

                    @Override
                    public void onAuthenticationError(int code, CharSequence error) {
                        authInProgress = false;
                        onAuthError(code, error);
                    }
                });
        findViewById(R.id.unlockButton).setOnClickListener((v) -> authenticate(LockAction.UNLOCK));
        hideFromRecents(isLockEnabled());
    }

    @Override
    protected void onStart() {
        super.onStart();
        long away = backgroundSince == 0 ? 0 : SystemClock.elapsedRealtime() - backgroundSince;
        if (away >= (ownIntentPending ? LOCK_AFTER_OWN_INTENT_MS : LOCK_AFTER_MS)) unlocked = false;
        backgroundSince = 0;
        ownIntentPending = false;

        if (!isLockEnabled()) {
            showLocked(false);
            return;
        }
        if (canAuthenticate() == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED) {
            // Kunci layar HP dihapus: tanpa itu kunci tidak bisa dibuka, jadi dimatikan agar data tidak terkunci selamanya
            setLockEnabled(false);
            showLocked(false);
            Toast.makeText(this, R.string.lock_auto_off, Toast.LENGTH_LONG).show();
            return;
        }
        showLocked(!unlocked);
        if (!unlocked && !authInProgress) authenticate(LockAction.UNLOCK);
    }

    @Override
    protected void onStop() {
        super.onStop();
        // Layar PIN di sebagian HP adalah layar terpisah. Saat membuka kunci, itu tidak dihitung sebagai
        // meninggalkan aplikasi (aplikasi memang masih terkunci); saat mengubah pengaturan tetap dihitung.
        boolean unlocking = authInProgress && pendingAction == LockAction.UNLOCK;
        if (!unlocking && !isChangingConfigurations()) backgroundSince = SystemClock.elapsedRealtime();
    }

    private boolean isLockEnabled() {
        return prefs.getBoolean(PREF_LOCK, false);
    }

    private void setLockEnabled(boolean enabled) {
        prefs.edit().putBoolean(PREF_LOCK, enabled).apply();
        hideFromRecents(enabled);
    }

    /** Android 13+: isi aplikasi tidak terlihat di daftar aplikasi terbaru selama kunci aktif. */
    private void hideFromRecents(boolean hide) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) setRecentsScreenshotEnabled(!hide);
    }

    private int canAuthenticate() {
        return BiometricManager.from(this).canAuthenticate(AUTHENTICATORS);
    }

    private String unavailableReason(int status) {
        return getString(status == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED
                ? R.string.lock_no_screen_lock : R.string.lock_unsupported);
    }

    private void showLocked(boolean locked) {
        lockScreen.setVisibility(locked ? View.VISIBLE : View.GONE);
        webView.setVisibility(locked ? View.INVISIBLE : View.VISIBLE);
        if (locked) lockMessage.setText(R.string.lock_hint);
    }

    private void authenticate(LockAction action) {
        if (authInProgress) return;
        pendingAction = action;
        authInProgress = true;
        int subtitle = action == LockAction.ENABLE ? R.string.lock_prompt_enable
                : action == LockAction.DISABLE ? R.string.lock_prompt_disable : R.string.lock_prompt_unlock;
        biometricPrompt.authenticate(new BiometricPrompt.PromptInfo.Builder()
                .setTitle(getString(R.string.lock_prompt_title))
                .setSubtitle(getString(subtitle))
                .setAllowedAuthenticators(AUTHENTICATORS)
                .build());
    }

    private void onAuthSucceeded() {
        switch (pendingAction) {
            case UNLOCK:
                unlocked = true;
                showLocked(false);
                break;
            case ENABLE:
                setLockEnabled(true);
                unlocked = true;
                sendLockResult(getString(R.string.lock_enabled));
                break;
            case DISABLE:
                setLockEnabled(false);
                sendLockResult(getString(R.string.lock_disabled));
                break;
        }
    }

    private void onAuthError(int code, CharSequence error) {
        boolean cancelled = code == BiometricPrompt.ERROR_USER_CANCELED
                || code == BiometricPrompt.ERROR_NEGATIVE_BUTTON || code == BiometricPrompt.ERROR_CANCELED;
        if (pendingAction == LockAction.UNLOCK) {
            // Tetap terkunci; tombol "Buka kunci" bisa dipakai untuk mencoba lagi
            lockMessage.setText(cancelled ? getString(R.string.lock_hint) : error);
        } else {
            sendLockResult(cancelled ? getString(R.string.lock_cancelled) : error.toString());
        }
    }

    /** Pengaturan kunci dari halaman: aktifkan/nonaktifkan, selalu lewat verifikasi bila memungkinkan. */
    private void requestLockChange(boolean enable) {
        if (enable == isLockEnabled()) {
            sendLockResult("");
            return;
        }
        int status = canAuthenticate();
        if (status != BiometricManager.BIOMETRIC_SUCCESS) {
            if (enable) {
                sendLockResult(unavailableReason(status));
            } else {
                // Tanpa kunci layar HP tidak ada yang bisa diverifikasi; mematikan tetap diizinkan
                setLockEnabled(false);
                sendLockResult(getString(R.string.lock_disabled));
            }
            return;
        }
        authenticate(enable ? LockAction.ENABLE : LockAction.DISABLE);
    }

    private void sendLockResult(String message) {
        webView.evaluateJavascript(
                "window.dompetkuLockResult && window.dompetkuLockResult(" + JSONObject.quote(message) + ")", null);
    }

    // ---------- Status bar, navigation bar, dan keyboard ----------

    private void applyInsets() {
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.root), (root, insets) -> {
            Insets bars = insets.getInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());

            setHeight(statusBg, bars.top);
            setHeight(navBg, bars.bottom);
            ViewGroup.MarginLayoutParams lp = (ViewGroup.MarginLayoutParams) webView.getLayoutParams();
            // Saat keyboard terbuka, WebView mengecil agar kolom chat tetap terlihat
            lp.setMargins(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
            webView.setLayoutParams(lp);
            return WindowInsetsCompat.CONSUMED;
        });
    }

    private static void setHeight(View v, int height) {
        ViewGroup.LayoutParams lp = v.getLayoutParams();
        lp.height = height;
        v.setLayoutParams(lp);
    }

    private void setBarColors(int top, int bottom) {
        statusBg.setBackgroundColor(top);
        navBg.setBackgroundColor(bottom);
        WindowInsetsControllerCompat c = new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView());
        c.setAppearanceLightStatusBars(Color.luminance(top) > 0.5f);
        c.setAppearanceLightNavigationBars(Color.luminance(bottom) > 0.5f);

        // Layar kunci ikut tema (latar = warna menu bawah) dan warna aksen aplikasi
        boolean lightBg = Color.luminance(bottom) > 0.5f;
        lockScreen.setBackgroundColor(bottom);
        ((TextView) findViewById(R.id.lockTitle)).setTextColor(lightBg ? 0xDE000000 : 0xFFFFFFFF);
        lockMessage.setTextColor(lightBg ? 0x99000000 : 0xB3FFFFFF);
        Button unlock = findViewById(R.id.unlockButton);
        unlock.setBackgroundTintList(ColorStateList.valueOf(top));
        unlock.setTextColor(Color.luminance(top) > 0.5f ? Color.BLACK : Color.WHITE);
    }

    // ---------- Pilih file dan ambil foto ----------

    private void registerFileLaunchers() {
        pickLauncher = registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), (result) ->
                deliverFiles(WebChromeClient.FileChooserParams.parseResult(result.getResultCode(), result.getData())));
        cameraLauncher = registerForActivityResult(new ActivityResultContracts.TakePicture(), (saved) ->
                deliverFiles(Boolean.TRUE.equals(saved) && cameraUri != null ? new Uri[]{cameraUri} : null));
    }

    private boolean openFileChooser(ValueCallback<Uri[]> callback, WebChromeClient.FileChooserParams params) {
        deliverFiles(null); // batalkan permintaan sebelumnya yang belum selesai
        fileCallback = callback;
        boolean images = Arrays.stream(params.getAcceptTypes()).anyMatch((t) -> t.startsWith("image/"));

        if (images && params.isCaptureEnabled()) {
            try {
                File dir = new File(getCacheDir(), "camera");
                if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("Folder kamera gagal dibuat");
                File photo = new File(dir, "struk-" + System.currentTimeMillis() + ".jpg");
                cameraUri = FileProvider.getUriForFile(this, getPackageName() + ".files", photo);
                ownIntentPending = true;
                cameraLauncher.launch(cameraUri);
                return true;
            } catch (IOException | ActivityNotFoundException e) {
                // Tidak ada aplikasi kamera: lanjut ke pemilih file biasa
            }
        }

        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        // File cadangan .json sering tidak dikenali tipenya oleh pengelola file, jadi selain gambar
        // semua file ditampilkan; isinya tetap diperiksa oleh aplikasi.
        intent.setType(images ? "image/*" : "*/*");
        try {
            ownIntentPending = true;
            pickLauncher.launch(intent);
            return true;
        } catch (ActivityNotFoundException e) {
            ownIntentPending = false;
            fileCallback = null;
            return false;
        }
    }

    private void deliverFiles(Uri[] uris) {
        if (fileCallback != null) {
            fileCallback.onReceiveValue(uris);
            fileCallback = null;
        }
    }

    // ---------- Jembatan untuk app.js (window.DompetkuAndroid) ----------

    private class Bridge {

        /** Menyimpan file ke folder Download. Mengembalikan false jika gagal. */
        @JavascriptInterface
        public boolean saveFile(String base64, String filename, String mime) {
            ContentResolver resolver = getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, safeName(filename));
            values.put(MediaStore.Downloads.MIME_TYPE, mime);
            values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
            values.put(MediaStore.Downloads.IS_PENDING, 1);
            Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) return false;
            try (OutputStream out = resolver.openOutputStream(uri)) {
                if (out == null) throw new IOException("Tidak bisa menulis file");
                out.write(Base64.decode(base64, Base64.DEFAULT));
            } catch (IOException | IllegalArgumentException e) {
                resolver.delete(uri, null, null);
                return false;
            }
            values.clear();
            values.put(MediaStore.Downloads.IS_PENDING, 0);
            resolver.update(uri, values, null, null);
            return true;
        }

        /** Membuka menu Share HP (Gmail, WhatsApp, Drive, ...). Mengembalikan false jika gagal. */
        @JavascriptInterface
        public boolean shareFile(String base64, String filename, String mime, String text) {
            try {
                File dir = new File(getCacheDir(), "share");
                if (!dir.isDirectory() && !dir.mkdirs()) return false;
                File file = new File(dir, safeName(filename));
                try (OutputStream out = new FileOutputStream(file)) {
                    out.write(Base64.decode(base64, Base64.DEFAULT));
                }
                Uri uri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".files", file);
                Intent send = new Intent(Intent.ACTION_SEND)
                        .setType(mime)
                        .putExtra(Intent.EXTRA_STREAM, uri)
                        .putExtra(Intent.EXTRA_SUBJECT, file.getName())
                        .putExtra(Intent.EXTRA_TEXT, text == null ? "" : text)
                        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                send.setClipData(ClipData.newRawUri(file.getName(), uri));
                runOnUiThread(() -> {
                    ownIntentPending = true;
                    startActivity(Intent.createChooser(send, getString(R.string.share_title)));
                });
                return true;
            } catch (IOException | IllegalArgumentException e) {
                return false;
            }
        }

        /** Status kunci aplikasi untuk halaman Pengaturan, dalam bentuk JSON. */
        @JavascriptInterface
        public String lockStatus() {
            int status = canAuthenticate();
            try {
                return new JSONObject()
                        .put("enabled", isLockEnabled())
                        .put("available", status == BiometricManager.BIOMETRIC_SUCCESS)
                        .put("reason", status == BiometricManager.BIOMETRIC_SUCCESS ? "" : unavailableReason(status))
                        .toString();
            } catch (JSONException e) {
                return "{}";
            }
        }

        /** Meminta verifikasi untuk mengaktifkan/menonaktifkan kunci; hasilnya ke window.dompetkuLockResult. */
        @JavascriptInterface
        public void requestLock(boolean enable) {
            runOnUiThread(() -> requestLockChange(enable));
        }

        /** Menyamakan warna status bar dengan bilah atas dan navigation bar dengan menu bawah. */
        @JavascriptInterface
        public void setSystemBars(String top, String bottom) {
            try {
                int topColor = Color.parseColor(top.trim());
                int bottomColor = Color.parseColor(bottom.trim());
                runOnUiThread(() -> setBarColors(topColor, bottomColor));
            } catch (IllegalArgumentException | NullPointerException ignored) {
            }
        }
    }

    private static String safeName(String filename) {
        String name = filename == null ? "" : filename.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_").trim();
        return name.isEmpty() || name.startsWith(".") ? "dompetku" + name : name;
    }
}
