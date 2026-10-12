-- Foundational topics remain after sample content is removed.
insert into public.topics(id,slug,name,description,sort_order) values
('10000000-0000-4000-8000-000000000001','housing','Housing','More room to live, closer to the places we love.',1),
('10000000-0000-4000-8000-000000000002','infrastructure','Infrastructure','The streets, buses, and connections that make a place work.',2),
('10000000-0000-4000-8000-000000000003','energy','Energy','Clean, reliable power that everyone can afford.',3),
('10000000-0000-4000-8000-000000000004','healthcare','Healthcare','Getting care should be simpler than getting sick.',4),
('10000000-0000-4000-8000-000000000005','education','Education','More paths to learning, from the first classroom onward.',5),
('10000000-0000-4000-8000-000000000006','technology','Technology','Useful tools, better systems, and more possibility.',6)
on conflict(slug) do nothing;
