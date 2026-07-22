CREATE TABLE "whatsapp_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "header_text" TEXT NOT NULL,
    "body_text" TEXT NOT NULL,
    "button1_id" TEXT NOT NULL DEFAULT 'agendar_cita',
    "button1_title" TEXT NOT NULL DEFAULT 'Agendar Cita',
    "button2_id" TEXT NOT NULL DEFAULT 'modificar_cita',
    "button2_title" TEXT NOT NULL DEFAULT 'Modificar Cita',
    "button3_id" TEXT NOT NULL DEFAULT 'solicitar_asesor',
    "button3_title" TEXT NOT NULL DEFAULT 'Solicitar Asesor',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "whatsapp_templates_name_key" ON "whatsapp_templates"("name");
