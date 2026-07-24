insert into public.events (
  id, name, slug, status, currency, wallet_default, max_per_team,
  coverage_target, opens_at, locks_at
)
values (
  '10000000-0000-0000-0000-000000000001',
  'AI Build Week Product Festival',
  'ai-build-week',
  'open',
  '€',
  100,
  50,
  75,
  now(),
  now() + interval '2 hours'
)
on conflict (id) do nothing;

insert into public.teams (
  id, event_id, number, name, slug, code, description, product_url,
  table_label, color
)
values
  (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    1, 'QueueLess', 'queueless', 'QUEUE7',
    'Objednávky bez čakania v rade.', 'https://example.com/?product=queueless',
    'Stôl 1', '#62c5c0'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    2, 'PitchPal', 'pitchpal', 'PITCH3',
    'Nácvik pitchu s konkrétnym feedbackom.', 'https://example.com/?product=pitchpal',
    'Stôl 2', '#f5a720'
  ),
  (
    '20000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    3, 'Gardenly', 'gardenly', 'GARDEN4',
    'Čo zasadiť a kedy sa o to postarať.', 'https://example.com/?product=gardenly',
    'Stôl 3', '#ed3b5b'
  )
on conflict (id) do nothing;

insert into public.people (id, event_id, name, role, wallet_budget)
values
  (
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Peter', 'participant', 100
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'Ada', 'participant', 100
  ),
  (
    '30000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    'Marek', 'mentor', 100
  ),
  (
    '30000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000001',
    'Organizátor', 'organizer', 100
  ),
  (
    '30000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000001',
    'Hosť', 'observer', 100
  )
on conflict (id) do nothing;

insert into public.access_codes (person_id, event_id, code)
values
  (
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'PETER'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'ADA'
  ),
  (
    '30000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    'MENTOR'
  ),
  (
    '30000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000001',
    'ADMIN'
  ),
  (
    '30000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000001',
    'GUEST'
  )
on conflict (person_id) do nothing;

insert into public.team_members (event_id, team_id, person_id)
values
  (
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001'
  ),
  (
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000002'
  )
on conflict (event_id, person_id) do nothing;

select public.refresh_event_stats('10000000-0000-0000-0000-000000000001');
