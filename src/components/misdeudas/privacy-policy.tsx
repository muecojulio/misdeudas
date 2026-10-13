import { ArrowUpRight, ShieldCheck } from "lucide-react";

/** Política de privacidad, mostrada dentro de la pestaña "Privacidad". */
export function PrivacyPolicyPanel() {
  return (
    <article className="policy-panel">
      <header className="policy-hero">
        <span className="policy-hero-icon">
          <ShieldCheck className="size-6" aria-hidden="true" />
        </span>
        <p className="policy-eyebrow">CLARA Y SIN LETRA CHIQUITA</p>
        <h2 className="font-display">Política de privacidad</h2>
        <p className="policy-lede">
          Mis deudas está diseñada para que tu libreta se quede en el navegador: su contenido no se
          sincroniza ni se sube a una base de datos de compras.
        </p>
        <p className="policy-date">Última actualización: 13 de octubre de 2026</p>
      </header>

      <aside className="policy-notice" role="note">
        <strong>Antes de usarla en una publicación comercial:</strong> el repositorio no identifica
        a la persona o entidad que publica cada instancia ni su domicilio o correo legal. El
        publicador debe completar esos datos de contacto y revisar esta política según la
        legislación que le aplique.
      </aside>

      <div className="policy-sections">
        <section className="policy-section">
          <h2>1. Qué información se guarda</h2>
          <p>
            Cuando usas la libreta, puedes guardar descripciones de compras, fechas, plazos,
            importes, pagos mensuales, nombres de personas, repartos de pagos, nombres de tarjetas y
            sus últimos cuatro dígitos, además de la apariencia y la sección que elegiste.
          </p>
          <p>
            No solicites ni guardes aquí números completos de tarjeta, códigos de seguridad
            (CVV/CVC), NIP, contraseñas bancarias ni credenciales de acceso. La aplicación solo
            contempla el nombre de la tarjeta y su terminación.
          </p>
        </section>

        <section className="policy-section">
          <h2>2. Dónde se guarda y por cuánto tiempo</h2>
          <p>
            Los datos de la libreta se guardan en el almacenamiento local del navegador
            (localStorage) del dispositivo donde la usas. La aplicación no sincroniza las compras
            entre dispositivos ni las guarda en una base de datos remota. El publicador del sitio
            puede aplicar controles de acceso o inicio de sesión aparte; estos no sincronizan el
            contenido de la libreta.
          </p>
          <p>
            La información permanece en ese navegador hasta que la borres desde{" "}
            <strong>Ajustes → Borrar tu libreta</strong>, elimines los datos del sitio en el
            navegador o desinstales/limpies el perfil que la contiene. Un cambio de dispositivo o
            navegador no transfiere automáticamente la libreta.
          </p>
          <p>
            El almacenamiento local de esta aplicación no está cifrado por ella. Protege el
            dispositivo y su perfil de navegador, especialmente si es compartido.
          </p>
        </section>

        <section className="policy-section">
          <h2>3. Conexiones a servicios públicos</h2>
          <p>
            La aplicación no manda tus nombres, compras, importes ni terminaciones de tarjeta a
            estos servicios.
          </p>
          <ul>
            <li>
              <strong>Días festivos de México:</strong> al abrir la libreta, se consulta el
              calendario público de{" "}
              <a href="https://date.nager.at/" target="_blank" rel="noreferrer">
                Nager.Date <ArrowUpRight className="inline size-3.5" aria-hidden="true" />
              </a>{" "}
              mediante una ruta del propio servicio. Solo se solicitan el año y el país México. El
              resultado puede guardarse localmente durante una semana; si la consulta falla, se usan
              fechas de respaldo incluidas en la aplicación.
            </li>
          </ul>
          <p>
            La infraestructura que sirve la aplicación procesa datos técnicos habituales de una
            solicitud web, como la dirección IP, la fecha y algunos encabezados del navegador, según
            su configuración y sus propios plazos de conservación. El proveedor público tiene sus
            propios registros y políticas; consulta su aviso si necesitas más detalle.
          </p>
        </section>

        <section className="policy-section">
          <h2>4. Caché, respaldo y archivos</h2>
          <p>
            El calendario se almacena en localStorage para evitar consultas repetidas. Esta caché no
            contiene datos de tus compras.
          </p>
          <p>
            Si descargas una copia, el archivo JSON contiene la información de tu libreta y no está
            cifrado. Se genera en el navegador y no se carga automáticamente. Tú decides dónde
            conservarlo o compartirlo. Importa solo archivos JSON de confianza; la aplicación valida
            su estructura antes de reemplazar los datos.
          </p>
        </section>

        <section className="policy-section">
          <h2>5. Cookies, medición y publicidad</h2>
          <p>
            La lógica de Mis deudas no instala cookies publicitarias ni incorpora analítica de
            comportamiento. Usa almacenamiento local para recordar la libreta, el tema, la sección y
            el calendario. La plataforma de alojamiento o la vista previa puede aplicar tecnologías
            técnicas propias, ajenas al contenido de la libreta.
          </p>
        </section>

        <section className="policy-section">
          <h2>6. Cómo acceder, corregir o borrar</h2>
          <p>
            Puedes consultar y editar la información directamente en la aplicación, descargar una
            copia o borrar la libreta desde Ajustes. Como los registros no se envían a una cuenta de
            usuario, no existe un panel remoto para recuperarlos o eliminarlos por ti.
          </p>
          <p>
            Si necesitas ejercer derechos previstos por la legislación aplicable, contacta a la
            persona o entidad que publicó esta instancia. No incluyas importes, nombres ni
            terminaciones de tarjeta en un mensaje de soporte.
          </p>
        </section>

        <section className="policy-section">
          <h2>7. Cambios y contacto</h2>
          <p>
            La política puede actualizarse si cambian las funciones, los servicios consultados o la
            legislación. La fecha de revisión se mostrará en esta página.
          </p>
          <p>
            Esta copia del proyecto no incluye un correo ni domicilio del responsable. El publicador
            debe añadir un canal de contacto válido antes de presentar la política como aviso legal
            definitivo.
          </p>
        </section>
      </div>

      <footer className="policy-footer">
        <p>Tu libreta es tuya. Guarda una copia privada si necesitas cambiar de dispositivo.</p>
      </footer>
    </article>
  );
}
