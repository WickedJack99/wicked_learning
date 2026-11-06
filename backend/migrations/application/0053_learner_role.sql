-- Every invitation-created account receives the source application's basic
-- learner role. Elevated role grants remain an explicit future access-control
-- slice; an invitation must not create a roleless principal that the browser
-- cannot resolve as its current user.
INSERT INTO application_roles (role_key)
VALUES ('learner')
ON CONFLICT (role_key) DO NOTHING;
