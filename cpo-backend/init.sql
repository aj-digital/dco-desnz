CREATE TABLE applications (
    id VARCHAR(50) PRIMARY KEY,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE documents (
    id VARCHAR(50) PRIMARY KEY,
    application_id VARCHAR(50) REFERENCES applications(id),
    section_key VARCHAR(100),
    field_key VARCHAR(100),
    filename TEXT NOT NULL,
    content_type VARCHAR(100),
    size_bytes BIGINT,
    s3_key_mock TEXT,
    status VARCHAR(50) DEFAULT 'AVAILABLE',
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE outbox_events (
    id SERIAL PRIMARY KEY,
    application_id VARCHAR(50) REFERENCES applications(id),
    event_type VARCHAR(100) NOT NULL,
    sync_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE
);
