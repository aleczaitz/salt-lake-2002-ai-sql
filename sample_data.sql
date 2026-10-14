-- shortcut: selected results from three 2002 events, import the full Games before reporting overall leaders.
-- Speed skating podiums and venue: https://www.olympedia.org/results/1113
-- https://www.olympedia.org/results/1114
-- Nordic combined top four and both venues: https://www.olympedia.org/results/2321

INSERT INTO athlete (athlete_id, name) VALUES
    (1, 'Jochem Uytdehaage'),
    (2, 'Derek Parra'),
    (3, 'Jens Boden'),
    (4, 'Gianni Romme'),
    (5, 'Lasse Sætre'),
    (6, 'Samppa Lajunen'),
    (7, 'Jaakko Tallus'),
    (8, 'Felix Gottwald'),
    (9, 'Ronny Ackermann');

INSERT INTO event (event_id, name, is_team_event) VALUES
    (1, 'Speed Skating - Men''s 5,000 metres', 0),
    (2, 'Speed Skating - Men''s 10,000 metres', 0),
    (3, 'Nordic Combined - Men''s Individual', 0);

INSERT INTO country (country_code, name) VALUES
    ('NED', 'Netherlands'), ('USA', 'United States'), ('GER', 'Germany'),
    ('NOR', 'Norway'), ('FIN', 'Finland'), ('AUT', 'Austria');

INSERT INTO venue (venue_id, name, location) VALUES
    (1, 'Utah Olympic Oval', 'Kearns, Utah'),
    (2, 'Utah Olympic Park', 'Park City, Utah'),
    (3, 'Soldier Hollow', 'Wasatch Mountain State Park, Utah');

INSERT INTO result (athlete_id, event_id, medal, country_code, team) VALUES
    (1, 1, 'Gold', 'NED', 'Netherlands'),
    (2, 1, 'Silver', 'USA', 'United States'),
    (3, 1, 'Bronze', 'GER', 'Germany'),
    (1, 2, 'Gold', 'NED', 'Netherlands'),
    (4, 2, 'Silver', 'NED', 'Netherlands'),
    (5, 2, 'Bronze', 'NOR', 'Norway'),
    (6, 3, 'Gold', 'FIN', 'Finland'),
    (7, 3, 'Silver', 'FIN', 'Finland'),
    (8, 3, 'Bronze', 'AUT', 'Austria'),
    (9, 3, NULL, 'GER', 'Germany');

INSERT INTO event_venue (event_id, venue_id) VALUES
    (1, 1),
    (2, 1),
    (3, 2),
    (3, 3);
