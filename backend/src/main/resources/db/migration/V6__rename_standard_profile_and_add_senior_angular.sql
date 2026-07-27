-- „Standard" war zu unspezifisch für ein Profil unter mehreren; sprechenderer Name passend
-- zum Rollenfeld. Zweites Profil für Ausschreibungen, die reinen Senior-Angular-Frontend
-- ohne Lead-/Architektur-/Backend-Anteil suchen (schmalere Skills, mehr No-Match-Signale).
update profiles set name = 'Frontend Architect & Angular Lead' where name = 'Standard';

insert into profiles (name, role, focus, industries, region, languages, skills_json, strong_signals_json, weak_signals_json, active)
values (
    'Senior Angular Frontend',
    'Senior Frontend Developer (Angular)',
    'Reiner Senior Angular Frontend-Entwickler',
    'Banking, Insurance, Public Sector, Industry',
    'DACH, remote',
    'Deutsch (native), Englisch (fließend)',
    '{"frontend":["Angular (2-22)","TypeScript","Signals","SignalStore","NgRx","RxJS","Nx","Tailwind CSS","PrimeNG","Angular Material","Barrierefreiheit (A11y)","OpenAPI","zoneless"],"devops_testing":["Playwright","Cypress","Jest","GitHub Actions"],"methods":["Clean Code","TDD","Agile"]}',
    '["Angular","Frontend","TypeScript","Senior","remote","DACH"]',
    '["Lead","Architect","Coaching","Fullstack","Backend","Java","Spring Boot",".NET","C#","PHP","Python (als Hauptsprache)","React","Vue","Junior","Pflicht Vor-Ort 5 Tage"]',
    false
);
