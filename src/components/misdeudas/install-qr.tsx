import { Check, Copy, Download, Monitor, Smartphone, Tablet } from "lucide-react";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { PressButton } from "./ui";

/** Pestaña con un código QR para abrir la app e instalarla en cualquier dispositivo. */
export function InstallQrPanel() {
  const [appUrl, setAppUrl] = useState("");
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);
  const [copied, setCopied] = useState(false);

  // Se calcula en el navegador: el código apunta siempre a la dirección donde se abrió la app.
  useEffect(() => {
    setAppUrl(`${window.location.origin}${window.location.pathname}`);
  }, []);

  useEffect(() => {
    if (!appUrl) return;
    let cancel = false;
    setQrError(false);
    QRCode.toDataURL(appUrl, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#1e4a38", light: "#ffffff" },
    })
      .then((src: string) => {
        if (!cancel) setQrSrc(src);
      })
      .catch(() => {
        if (!cancel) setQrError(true);
      });
    return () => {
      cancel = true;
    };
  }, [appUrl]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="settings-layout install-layout">
      <section className="settings-card install-qr-card">
        <div className="settings-card-heading">
          <span className="settings-icon settings-icon-sky">
            <Download className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-2xl">Instala la app</h2>
            <p className="text-sm text-mist">Escanea el código con la cámara de tu dispositivo.</p>
          </div>
        </div>

        <div className="install-qr-frame">
          {qrSrc ? (
            <img
              src={qrSrc}
              alt={`Código QR para abrir e instalar Mis deudas en ${appUrl}`}
              width={240}
              height={240}
              className="install-qr-image"
            />
          ) : (
            <p className="text-sm text-mist" role="status">
              {qrError ? "No se pudo generar el código QR." : "Generando código QR…"}
            </p>
          )}
        </div>

        {appUrl ? (
          <div className="install-link-row">
            <code className="install-link" translate="no">
              {appUrl}
            </code>
            <PressButton type="button" onClick={copyLink} className="settings-secondary-button">
              {copied ? (
                <Check className="size-4" aria-hidden="true" />
              ) : (
                <Copy className="size-4" aria-hidden="true" />
              )}
              {copied ? "Copiado" : "Copiar enlace"}
            </PressButton>
          </div>
        ) : null}
      </section>

      <section className="settings-card">
        <div className="settings-card-heading">
          <span className="settings-icon settings-icon-lilac">
            <Smartphone className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-2xl">Cómo instalarla</h2>
            <p className="text-sm text-mist">Los pasos cambian según tu sistema.</p>
          </div>
        </div>

        <div className="install-steps">
          <article className="install-step-card">
            <h3>
              <Smartphone className="size-4" aria-hidden="true" /> iPhone y iPad
            </h3>
            <ol>
              <li>Abre el enlace o escanea el código con la cámara.</li>
              <li>
                Usa Safari (en iOS también funciona desde otros navegadores, pero Safari es el que
                permite agregarla).
              </li>
              <li>
                Toca <strong>Compartir</strong> y luego{" "}
                <strong>Agregar a pantalla de inicio</strong>.
              </li>
            </ol>
          </article>

          <article className="install-step-card">
            <h3>
              <Tablet className="size-4" aria-hidden="true" /> Android
            </h3>
            <ol>
              <li>Escanea el código o abre el enlace en Chrome.</li>
              <li>
                Toca el menú <strong>⋮</strong> del navegador.
              </li>
              <li>
                Elige <strong>Instalar aplicación</strong> o{" "}
                <strong>Agregar a la pantalla principal</strong>.
              </li>
            </ol>
          </article>

          <article className="install-step-card">
            <h3>
              <Monitor className="size-4" aria-hidden="true" /> Computadora
            </h3>
            <ol>
              <li>Abre el enlace en Chrome, Edge u otro navegador basado en Chromium.</li>
              <li>
                Haz clic en el icono <strong>Instalar</strong> de la barra de direcciones.
              </li>
              <li>Confirma para abrirla como aplicación independiente.</li>
            </ol>
          </article>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-mist">
          La app se instala desde el navegador y no pide tienda ni registro. Tus compras se quedan
          en cada dispositivo; instalarla no las copia a otro.
        </p>
      </section>
    </div>
  );
}
