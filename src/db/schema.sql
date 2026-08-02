CREATE TABLE resources ( 
id SERIAL PRIMARY KEY,
name TEXT NOT NULL,
pool TEXT NOT NULL,
UNIQUE(name, pool)
);
CREATE TABLE reservations (
id SERIAL PRIMARY KEY,
resource_id INT NOT NULL REFERENCES resources(id),
team TEXT NOT NULL,
booked_hours NUMERIC NOT NULL,
actual_used_hours NUMERIC NOT NULL DEFAULT 0,
is_ghost BOOLEAN GENERATED ALWAYS AS (actual_used_hours =0) STORED,
booking_start DATE NOT NULL,
raw_status TEXT,
created_at TIMESTAMP DEFAULT now(),
CONSTRAINT unique_reservation UNIQUE (resource_id, team, booking_start, booked_hours, actual_used_hours)
);
CREATE INDEX idx_reservations_resource ON reservations(resource_id);
CREATE INDEX idx_reservations_team ON reservations(team);

