-- ==============================================================================
-- BASE DE DATOS PARA ORQUESTADOR DE AGENTES BAAS (PostgreSQL / Supabase)
-- ==============================================================================

-- Habilitar extensión para UUIDs (si no está habilitada)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 1. AGENCIAS (Agencies)
-- Almacena la información de la agencia de marketing que usa el sistema.
-- ==============================================================================
CREATE TABLE agencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL, -- Referencia a auth.users de Supabase
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'agency', -- 'superadmin' or 'agency'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Habilitar RLS (Row Level Security) para agencies
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmins can view all agencies, agencies can only view themselves" ON agencies
    FOR ALL USING (
        auth.uid() = user_id 
        OR 
        'superadmin' = (SELECT role FROM agencies WHERE user_id = auth.uid() LIMIT 1)
    );

-- ==============================================================================
-- 2. CONFIGURACIÓN DE AGENCIA (Agency Settings)
-- Guarda las credenciales de n8n, WAHA y Resend.
-- *NOTA DE SEGURIDAD*: En producción usar Supabase Vault para los campos _key.
-- ==============================================================================
CREATE TABLE agency_settings (
    agency_id UUID PRIMARY KEY,
    n8n_url VARCHAR(500),
    n8n_api_key VARCHAR(500), -- Sensible
    waha_url VARCHAR(500),
    waha_api_key VARCHAR(500), -- Sensible
    resend_api_key VARCHAR(500), -- Sensible
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_agency FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE
);

ALTER TABLE agency_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agencies can only manage their own settings" ON agency_settings
    FOR ALL USING (
        agency_id IN (SELECT id FROM agencies WHERE user_id = auth.uid())
        OR 
        'superadmin' = (SELECT role FROM agencies WHERE user_id = auth.uid() LIMIT 1)
    );

-- ==============================================================================
-- 3. PROYECTOS / BOTs (Projects)
-- Cada proyecto es un bot desplegado para un cliente final de la agencia.
-- ==============================================================================
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    industry VARCHAR(100) NOT NULL,
    personality_prompt TEXT NOT NULL,
    bot_active BOOLEAN DEFAULT TRUE,
    waha_session_id VARCHAR(100),
    waha_status VARCHAR(50) DEFAULT 'PENDING_QR', -- PENDING_QR, CONNECTED, DISCONNECTED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_agency_project FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agencies can only manage their own projects" ON projects
    FOR ALL USING (
        agency_id IN (SELECT id FROM agencies WHERE user_id = auth.uid())
        OR 
        'superadmin' = (SELECT role FROM agencies WHERE user_id = auth.uid() LIMIT 1)
    );

-- ==============================================================================
-- 4. PRODUCTOS (Products)
-- Tabla para almacenar el catálogo de cada bot.
-- ==============================================================================
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    stock INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_project_product FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agencies can only manage products for their projects" ON products
    FOR ALL USING (
        project_id IN (
            SELECT id FROM projects WHERE agency_id IN (
                SELECT id FROM agencies WHERE user_id = auth.uid()
            )
        )
        OR 
        'superadmin' = (SELECT role FROM agencies WHERE user_id = auth.uid() LIMIT 1)
    );

-- ==============================================================================
-- TRIGGERS
-- ==============================================================================
-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_agencies_updated_at BEFORE UPDATE ON agencies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_agency_settings_updated_at BEFORE UPDATE ON agency_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
