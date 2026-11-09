import java.util.Properties

plugins {
    id("com.android.application")
}

// Kunci tanda tangan release dibaca dari android/keystore.properties. File itu dan file kuncinya (.jks)
// TIDAK boleh masuk git; lihat bagian "Versi release" di README.
val keystoreProps = Properties().apply {
    val f = rootProject.file("keystore.properties")
    if (f.isFile) f.inputStream().use { load(it) }
}

android {
    namespace = "com.dompetku.app"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.dompetku.app"
        minSdk = 29
        targetSdk = 37
        versionCode = 1
        versionName = "1.0"
    }

    signingConfigs {
        if (keystoreProps.getProperty("storeFile") != null) {
            create("release") {
                storeFile = file(keystoreProps.getProperty("storeFile"))
                storePassword = keystoreProps.getProperty("storePassword")
                keyAlias = keystoreProps.getProperty("keyAlias")
                keyPassword = keystoreProps.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            // Kode dipadatkan (R8); aturan bawaan sudah menjaga method @JavascriptInterface
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
            // Tanpa keystore.properties, hasilnya APK release yang belum ditandatangani
            signingConfig = signingConfigs.findByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.activity:activity:1.13.0")
    implementation("androidx.fragment:fragment:1.9.1")
    implementation("androidx.biometric:biometric:1.1.0")
    implementation("androidx.core:core:1.19.1")
    implementation("androidx.webkit:webkit:1.15.0")
}

// File web (index.html, app.js, style.css, ...) diambil langsung dari folder utama proyek
// setiap kali build, jadi tidak ada salinan yang perlu disamakan secara manual.
abstract class CopyWebAssets : DefaultTask() {
    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val webFiles: ConfigurableFileCollection

    @get:OutputDirectory
    abstract val outputDir: DirectoryProperty

    @get:Inject
    abstract val fs: FileSystemOperations

    @TaskAction
    fun copy() {
        fs.sync {
            from(webFiles)
            into(outputDir.dir("www"))
        }
    }
}

val copyWebAssets = tasks.register<CopyWebAssets>("copyWebAssets") {
    webFiles.from(
        fileTree(rootDir.parentFile) {
            include("index.html", "app.js", "style.css", "manifest.json", "icons/**")
        }
    )
}

androidComponents {
    onVariants { variant ->
        variant.sources.assets?.addGeneratedSourceDirectory(copyWebAssets, CopyWebAssets::outputDir)
    }
}
