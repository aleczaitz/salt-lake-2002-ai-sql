CREATE TABLE athlete (
    athlete_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE event (
    event_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    is_team_event INTEGER NOT NULL CHECK (is_team_event IN (0, 1))
);

CREATE TABLE country (
    country_code TEXT PRIMARY KEY NOT NULL CHECK (country_code GLOB '[A-Z][A-Z][A-Z]'),
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE venue (
    venue_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT NOT NULL
);

CREATE TABLE result (
    athlete_id INTEGER NOT NULL,
    event_id INTEGER NOT NULL,
    medal TEXT CHECK (medal IN ('Gold', 'Silver', 'Bronze')),
    country_code TEXT NOT NULL,
    team TEXT NOT NULL,
    PRIMARY KEY (athlete_id, event_id),
    FOREIGN KEY (athlete_id) REFERENCES athlete (athlete_id),
    FOREIGN KEY (event_id) REFERENCES event (event_id),
    FOREIGN KEY (country_code) REFERENCES country (country_code)
);

CREATE TABLE event_venue (
    event_id INTEGER NOT NULL,
    venue_id INTEGER NOT NULL,
    PRIMARY KEY (event_id, venue_id),
    FOREIGN KEY (event_id) REFERENCES event (event_id),
    FOREIGN KEY (venue_id) REFERENCES venue (venue_id)
);
