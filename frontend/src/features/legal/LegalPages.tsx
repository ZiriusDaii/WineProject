import React from 'react';

interface LegalSection {
  heading: string;
  body: string;
}

const LegalPageLayout: React.FC<{ title: string; updated: string; sections: LegalSection[]; onBack: () => void }> = ({ title, updated, sections, onBack }) => (
  <div className="max-w-3xl mx-auto px-6 py-12 flex-1 w-full animate-fade-in text-left">
    <button onClick={onBack} className="mb-8 text-xs font-semibold text-[#8E1B54] hover:underline">‹ Volver</button>
    <h1 className="serif-title text-3xl text-[#3B0019] mb-1">{title}</h1>
    <p className="text-[10px] text-[#A68F63] uppercase tracking-wider font-semibold mb-8">Ultima actualizacion: {updated}</p>
    <div className="space-y-8">
      {sections.map((s) => (
        <section key={s.heading}>
          <h2 className="serif-title text-lg text-[#5C0632] mb-3">{s.heading}</h2>
          <p className="text-sm text-[#57534E] leading-relaxed whitespace-pre-line">{s.body}</p>
        </section>
      ))}
    </div>
  </div>
);

export const TerminosCondiciones: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <LegalPageLayout
    title="Terminos y Condiciones"
    updated="Julio 2026"
    onBack={onBack}
    sections={[
      {
        heading: '1. Objeto y Alcance',
        body: `Los presentes Terminos y Condiciones regulan el acceso y uso de la plataforma digital WineSpa (en adelante, "la Plataforma"), operada por WineSpa SAS, con domicilio principal en la ciudad de Medellin, Colombia.

La Plataforma tiene como finalidad permitir a los usuarios (en adelante, "Clientes") consultar el catalogo de servicios de manicura, pedicura y nail art ofrecidos por profesionales independientes (en adelante, "Especialistas") que prestan sus servicios en las distintas sedes de WineSpa, asi como agendar, reprogramar y cancelar citas de manera autogestionada.

El acceso y uso de la Plataforma implica la aceptacion integra e incondicional de estos Terminos y Condiciones. Si el Cliente no esta de acuerdo con los mismos, debera abstenerse de utilizar la Plataforma.`
      },
      {
        heading: '2. Registro y Uso de la Plataforma',
        body: `Para utilizar los servicios de agendamiento, el Cliente debera autenticarse mediante su numero de telefono celular. Al proporcionar dicho numero, el Cliente declara ser su titular legitimo y autoriza a WineSpa a utilizarlo como medio de contacto para confirmaciones, recordatorios y notificaciones relacionadas con sus citas.

El Cliente se compromete a:
- Proporcionar informacion veraz, actualizada y completa durante el registro.
- No utilizar la Plataforma con fines fraudulentos, ilicitos o contrarios a la moral y las buenas costumbres.
- No intentar eludir, desactivar o manipular las funcionalidades de seguridad de la Plataforma.
- Respetar los horarios de las citas agendadas y las politicas de cancelacion establecidas.

WineSpa se reserva el derecho de suspender o cancelar la cuenta de cualquier Cliente que incumpla estas disposiciones, sin que ello genere derecho a indemnizacion alguna.`
      },
      {
        heading: '3. Servicios, Precios y Pagos',
        body: `Los servicios ofrecidos a traves de la Plataforma son prestados por Especialistas en las instalaciones fisicas de cada sede de WineSpa. Los precios publicados en el catalogo estan expresados en pesos colombianos (COP) e incluyen todos los impuestos aplicables, salvo indicacion expresa en contrario.

WineSpa se reserva el derecho de modificar los precios, descripciones y disponibilidad de los servicios en cualquier momento sin previo aviso. Los cambios no afectaran las citas ya confirmadas.

El pago de los servicios se realiza directamente en la sede al momento de la prestacion del servicio, salvo que se indique una modalidad diferente para ofertas o paquetes especiales. La Plataforma no procesa pagos en linea; actua exclusivamente como sistema de agendamiento y gestion de turnos.

Los codigos de descuento y ofertas especiales tienen vigencia limitada, estan sujetos a disponibilidad y no son acumulables con otras promociones, salvo que se especifique lo contrario en los terminos particulares de cada oferta.`
      },
      {
        heading: '4. Responsabilidad y Garantias',
        body: `WineSpa actua como intermediario tecnologico entre el Cliente y las Especialistas, facilitando el agendamiento de citas. Los servicios de manicura, pedicura y nail art son ejecutados directamente por las Especialistas, quienes son responsables de la calidad y seguridad de los mismos.

WineSpa no garantiza la disponibilidad ininterrumpida de la Plataforma y no sera responsable por interrupciones temporales del servicio derivadas de mantenimiento, fallas tecnicas, caso fortuito o fuerza mayor.

El Cliente reconoce que los resultados de los tratamientos de uñas pueden variar segun factores individuales como el estado de la uña natural, el cuidado posterior y los habitos del Cliente. WineSpa y sus Especialistas no garantizan una duracion especifica del esmaltado o tratamiento.

La responsabilidad de WineSpa frente a cualquier reclamacion se limitara, en todos los casos, al valor del servicio contratado.`
      },
      {
        heading: '5. Propiedad Intelectual',
        body: `Todos los derechos de propiedad intelectual sobre la Plataforma, incluyendo pero no limitado a su codigo fuente, diseno visual, logotipos, marcas, nombres comerciales, textos, imagenes y demas contenidos, son titularidad exclusiva de WineSpa SAS o de sus licenciantes.

Queda expresamente prohibida la reproduccion, distribucion, transformacion, comunicacion publica o cualquier otra forma de explotacion no autorizada de los contenidos de la Plataforma, sin el consentimiento previo y por escrito de WineSpa.`
      },
      {
        heading: '6. Modificaciones a los Terminos',
        body: `WineSpa se reserva el derecho de modificar los presentes Terminos y Condiciones en cualquier momento. Las modificaciones entraran en vigor a partir de su publicacion en la Plataforma.

Se notificara a los Clientes sobre cambios sustanciales mediante un aviso visible en la Plataforma o a traves del numero de telefono registrado. El uso continuado de la Plataforma tras la entrada en vigor de las modificaciones constituye la aceptacion tacita de los nuevos terminos.`
      },
      {
        heading: '7. Legislacion Aplicable y Jurisdiccion',
        body: `Los presentes Terminos y Condiciones se rigen por las leyes de la Republica de Colombia. Para la resolucion de cualquier controversia derivada de la interpretacion o ejecucion de los mismos, las partes se someten a la jurisdiccion de los jueces de la ciudad de Medellin, con renuncia expresa a cualquier otro fuero que pudiera corresponderles.`
      },
    ]}
  />
);

export const PoliticaPrivacidad: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <LegalPageLayout
    title="Politica de Privacidad y Tratamiento de Datos"
    updated="Julio 2026"
    onBack={onBack}
    sections={[
      {
        heading: '1. Identificacion del Responsable',
        body: `En cumplimiento de lo dispuesto en la Ley 1581 de 2012 y el Decreto 1377 de 2013, se informa al titular de los datos personales que WineSpa SAS, con domicilio en la ciudad de Medellin, es el responsable del tratamiento de los datos personales recolectados a traves de su plataforma digital, sus sedes fisicas y su canal de atencion al cliente.`
      },
      {
        heading: '2. Datos Personales que Recolectamos',
        body: `Para la prestacion de nuestros servicios de agendamiento y atencion personalizada, WineSpa recolecta los siguientes datos personales:

- Nombre completo del Cliente.
- Numero de telefono celular (utilizado como identificador unico de cuenta y medio de contacto principal).
- Edad y genero (datos opcionales utilizados para personalizar la experiencia del servicio).
- Historial de servicios contratados y citas agendadas en nuestras sedes.
- Preferencias de manicurista, sede y tipo de servicio.

No recolectamos datos sensibles, financieros ni biometricos. La Plataforma no almacena informacion de tarjetas de credito o debito, ya que los pagos se realizan presencialmente en cada sede.`
      },
      {
        heading: '3. Finalidad del Tratamiento',
        body: `Los datos personales recolectados seran utilizados exclusivamente para las siguientes finalidades:

- Gestionar el registro del Cliente en la Plataforma y permitir su autenticacion mediante numero de telefono.
- Procesar, confirmar, modificar y cancelar las citas agendadas por el Cliente.
- Enviar recordatorios de citas proximas y notificaciones operativas relacionadas con el servicio contratado.
- Mantener un historial de visitas y preferencias que permita ofrecer una atencion personalizada.
- Realizar analisis internos y estadisticas anonimizadas para mejorar la calidad del servicio.
- Enviar informacion sobre ofertas, promociones y novedades de WineSpa, unicamente cuando el Cliente haya otorgado su consentimiento expreso.

En ningun caso los datos seran vendidos, cedidos, compartidos o transferidos a terceros no autorizados, salvo obligacion legal o requerimiento de autoridad competente.`
      },
      {
        heading: '4. Derechos del Titular',
        body: `De conformidad con la Ley 1581 de 2012, el Cliente en su calidad de titular de los datos personales tiene los siguientes derechos:

- Conocer, actualizar y rectificar sus datos personales frente a WineSpa. El Cliente puede ejercer este derecho directamente desde su perfil en la Plataforma o solicitandolo a traves de los canales de contacto indicados en la presente politica.
- Solicitar prueba de la autorizacion otorgada para el tratamiento de sus datos, salvo en los casos en que la ley exceptue dicha autorizacion.
- Ser informado por WineSpa, previa solicitud, respecto del uso que se le ha dado a sus datos personales.
- Presentar ante la Superintendencia de Industria y Comercio quejas por infracciones a la normativa de proteccion de datos.
- Revocar la autorizacion y/o solicitar la supresion de sus datos cuando no exista un deber legal o contractual que obligue a conservarlos.
- Abstenerse de responder preguntas sobre datos sensibles o datos de menores de edad.

Para ejercer cualquiera de estos derechos, el Cliente puede comunicarse al correo electronico privacidad@winespa.com.co o al numero de atencion al cliente +57 300 000 0000.`
      },
      {
        heading: '5. Medidas de Seguridad',
        body: `WineSpa adopta medidas tecnicas, administrativas y organizativas razonables para proteger los datos personales contra acceso no autorizado, perdida, alteracion, divulgacion o destruccion. Entre estas medidas se incluyen:

- Almacenamiento de datos en servidores con cifrado en reposo y en transito.
- Acceso restringido a los datos unicamente por personal autorizado con obligaciones de confidencialidad.
- Autenticacion mediante numero de telefono sin almacenamiento de contraseñas en texto plano.
- Auditorias periodicas de seguridad y monitoreo de accesos.

En caso de presentarse un incidente de seguridad que afecte los datos personales de los Clientes, WineSpa notificara a la autoridad competente y a los titulares afectados en los terminos establecidos por la ley.`
      },
      {
        heading: '6. Periodo de Conservacion y Contacto',
        body: `Los datos personales del Cliente se conservaran durante el tiempo que este mantenga actividad en la Plataforma y, posteriormente, por un periodo adicional de hasta diez (10) años para fines de registro historico y cumplimiento de obligaciones legales, salvo que el Cliente solicite su supresion en ejercicio de sus derechos.

Para cualquier consulta, queja, reclamo o solicitud relacionada con la privacidad y el tratamiento de datos personales, el Cliente puede contactar a WineSpa a traves de los siguientes canales:

- Correo electronico: privacidad@winespa.com.co
- Telefono: +57 300 000 0000
- Direccion fisica: S1 local 104, Cc. Parque Fabricato, Medellin, Colombia

Todas las solicitudes seran atendidas en un plazo maximo de diez (10) dias habiles contados a partir de su recepcion.`
      },
    ]}
  />
);

export const PoliticaCancelacion: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <LegalPageLayout
    title="Politica de Cancelacion y Reprogramacion"
    updated="Julio 2026"
    onBack={onBack}
    sections={[
      {
        heading: '1. Cancelacion por Parte del Cliente',
        body: `El Cliente podra cancelar su cita agendada sin costo alguno siempre que lo haga con una antelacion minima de cuatro (4) horas respecto a la hora programada. La cancelacion puede realizarse directamente desde la Plataforma, a traves de la seccion "Mis Citas" en el portal del Cliente, seleccionando la cita correspondiente y confirmando la cancelacion.

Las citas canceladas con menos de cuatro (4) horas de antelacion podran estar sujetas a una penalidad equivalente al treinta por ciento (30%) del valor del servicio contratado, a discrecion de WineSpa, como compensacion por el espacio reservado que no pudo ser reasignado a otro Cliente.

La cancelacion de una cita no genera derecho a reembolso de servicios ya prestados ni de promociones aplicadas. Los codigos de descuento utilizados en citas canceladas no seran reutilizables, salvo que la cancelacion se realice dentro del plazo establecido sin penalidad.`
      },
      {
        heading: '2. Reprogramacion de Citas',
        body: `El Cliente podra reprogramar su cita sin costo adicional siempre que lo haga con una antelacion minima de cuatro (4) horas respecto a la hora originalmente programada y exista disponibilidad en el nuevo horario solicitado.

La reprogramacion esta sujeta a la disponibilidad de la Especialista seleccionada y de la sede correspondiente. Si la Especialista original no esta disponible en el nuevo horario, el Cliente podra elegir otra Especialista disponible en la misma sede, conservando los mismos servicios contratados.

En caso de que el Cliente desee reprogramar con menos de cuatro (4) horas de antelacion, la solicitud estara sujeta a la politica de cancelacion tardia descrita en el punto anterior y se requerira contacto directo con la sede.`
      },
      {
        heading: '3. Cancelacion o Reprogramacion por Parte de WineSpa',
        body: `WineSpa se reserva el derecho de cancelar o reprogramar una cita en las siguientes circunstancias:

- Ausencia imprevista de la Especialista asignada por enfermedad, calamidad domestica o fuerza mayor.
- Cierre temporal o emergencia en la sede correspondiente.
- Fallas en los servicios publicos esenciales que impidan la prestacion adecuada del servicio (agua, energia electrica).
- Identificacion de un error en el sistema de agendamiento que haya generado una sobreventa de cupos.

En cualquiera de estos casos, WineSpa notificara al Cliente con la mayor antelacion posible a traves del numero de telefono registrado y ofrecera opciones de reprogramacion prioritaria o, a eleccion del Cliente, la cancelacion sin penalidad alguna.`
      },
      {
        heading: '4. No Presentacion (No-Show) y Retrasos',
        body: `Se considera "no-show" cuando el Cliente no se presenta a su cita en la fecha y hora programadas sin haber realizado la cancelacion correspondiente a traves de la Plataforma.

Los Clientes que incurran en no-show podran estar sujetos a las siguientes medidas:

- Primera ocurrencia: aviso recordatorio sobre la importancia de cancelar con antelacion.
- Segunda ocurrencia: penalidad del cincuenta por ciento (50%) del valor del servicio contratado.
- Tercera ocurrencia: restriccion temporal de la cuenta para nuevos agendamientos, sujeta a revision.

En cuanto a los retrasos, se concede una tolerancia maxima de diez (10) minutos sobre la hora programada. Transcurrido este margen sin que el Cliente se haya presentado, la cita se considerara no-show y la Especialista podra ser asignada a otro Cliente en espera. Si el Cliente llega con retraso dentro del margen de tolerancia, el servicio se prestara por el tiempo restante de la sesion, sin que ello implique una reduccion en el precio del servicio.`
      },
      {
        heading: '5. Reembolsos',
        body: `Los servicios de WineSpa se pagan de manera presencial al momento de su prestacion; por lo tanto, la Plataforma no gestiona reembolsos de pagos en linea.

En caso de que se hubiera realizado un pago anticipado para un servicio que sea cancelado por WineSpa, el Cliente tendra derecho al reembolso integro del valor pagado o a su aplicacion como credito para servicios futuros, a su eleccion.

Cualquier solicitud de reembolso debera presentarse por escrito al correo contacto@winespa.com.co y sera resuelta en un plazo maximo de quince (15) dias habiles.`
      },
    ]}
  />
);
