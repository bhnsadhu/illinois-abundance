import type { Topic, Writer, PublicPost, Event, LearnPage, Meeting } from './types';

// Public sample content only. Never add email addresses or submission records here.
// Fixed identifiers keep local previews and repeatable database seeds aligned.

export const sampleTopics: Topic[] = [
  {
    "id": "10000000-0000-4000-8000-000000000001",
    "slug": "housing",
    "name": "Housing",
    "description": "More places to live. More room to belong.",
    "sort_order": 0,
    "is_active": true,
    "is_sample": false
  },
  {
    "id": "10000000-0000-4000-8000-000000000002",
    "slug": "infrastructure",
    "name": "Infrastructure",
    "description": "Better ways to get where life takes you.",
    "sort_order": 1,
    "is_active": true,
    "is_sample": false
  },
  {
    "id": "10000000-0000-4000-8000-000000000003",
    "slug": "energy",
    "name": "Energy",
    "description": "Clean power and a future we can build.",
    "sort_order": 2,
    "is_active": true,
    "is_sample": false
  },
  {
    "id": "10000000-0000-4000-8000-000000000004",
    "slug": "healthcare",
    "name": "Healthcare",
    "description": "Care that is easier to find and reach.",
    "sort_order": 3,
    "is_active": true,
    "is_sample": false
  },
  {
    "id": "10000000-0000-4000-8000-000000000005",
    "slug": "education",
    "name": "Education",
    "description": "More ways to learn, on campus and beyond.",
    "sort_order": 4,
    "is_active": true,
    "is_sample": false
  },
  {
    "id": "10000000-0000-4000-8000-000000000006",
    "slug": "technology",
    "name": "Technology",
    "description": "Useful tools for the things we share.",
    "sort_order": 5,
    "is_active": true,
    "is_sample": false
  }
];

export const sampleWriters: Writer[] = [
  {
    "id": "20000000-0000-4000-8000-000000000001",
    "slug": "maya-patel",
    "name": "Maya Patel",
    "bio": "A fictional sample writer interested in housing, energy, and the everyday places that bring a community together.",
    "avatar_url": null,
    "avatar_alt": null,
    "is_sample": true
  },
  {
    "id": "20000000-0000-4000-8000-000000000002",
    "slug": "theo-brooks",
    "name": "Theo Brooks",
    "bio": "A fictional sample writer exploring public transportation, access to care, and simpler public services.",
    "avatar_url": null,
    "avatar_alt": null,
    "is_sample": true
  }
];

export const samplePosts: PublicPost[] = [
  {
    "id": "30000000-0000-4000-8000-000000000001",
    "slug": "room-for-more-neighbors",
    "author_name": "Maya Patel",
    "final_body": "CHAMPAIGN, Ill.\n\nFinding a place to live should leave room for the rest of your life. Instead, the search can become a spreadsheet of tradeoffs: a longer walk, another roommate, a kitchen that barely fits a table.\n\nIt is tempting to treat that search as a private problem. But the choices available to each of us start with public decisions about what our neighborhoods can become.\n\n## What would room for more neighbors look like?\n\nPicture a small apartment building near a bus stop. A home above a corner shop. An older house thoughtfully divided into a few apartments. None of these ideas has to erase the things we like about a street. They can help more people share them.\n\nGood housing policy still needs to ask hard questions. Are the sidewalks comfortable? Can a renter get a repair? Does a new building connect to everyday destinations? More homes and better homes belong in the same conversation.\n\nStudents can start by looking at a familiar block and asking what the rules allow there. Then ask who those rules leave out.\n\nA neighborhood is more than its buildings. It is also the people who get a chance to stay. We should make room for them.",
    "headline": "Let’s make room for more neighbors.",
    "short_version": "A home near the places you love should not be so hard to find. A more welcoming city starts with making room.",
    "sources": [],
    "topic_id": "10000000-0000-4000-8000-000000000001",
    "byline": "Maya Patel",
    "writer_id": "20000000-0000-4000-8000-000000000001",
    "cover_url": null,
    "cover_alt": null,
    "published_at": "2026-10-11T15:00:00Z",
    "updated_at": "2026-10-11T15:00:00Z",
    "is_sample": true
  },
  {
    "id": "30000000-0000-4000-8000-000000000002",
    "slug": "better-bus-trip",
    "author_name": "Theo Brooks",
    "final_body": "CHAMPAIGN, Ill.\n\nA bus ride begins before you step onto the bus. It begins when you decide whether the trip will work at all. Can you get to class without leaving absurdly early? Can you stay for the end of a shift? Will there be a way home?\n\nThose questions are about more than a line on a map. They are about whether a service fits an ordinary day.\n\n## What makes a bus worth waiting for?\n\nFrequency deserves a place near the top of the list. A route that comes often gives you more freedom to leave when you are ready. A comfortable stop, a safe crossing, and clear arrival information make that freedom easier to use.\n\nWe should ask about the whole trip, too. A fast ride does not solve a difficult walk across a wide road. A shelter matters when the weather turns. Connections matter when your destination is beyond campus.\n\nA useful student project would be simple: choose a common trip, take it at different times, and write down where uncertainty enters. Share what you learn with the people planning the service.\n\nBetter transportation is not only about moving vehicles. It is about making the next place in your day easier to reach.",
    "headline": "A better bus trip starts before the bus arrives.",
    "short_version": "Getting across town should fit into an ordinary day. Let’s look at the whole trip, from the first sidewalk to the last connection.",
    "sources": [],
    "topic_id": "10000000-0000-4000-8000-000000000002",
    "byline": "Theo Brooks",
    "writer_id": "20000000-0000-4000-8000-000000000002",
    "cover_url": null,
    "cover_alt": null,
    "published_at": "2026-10-10T15:00:00Z",
    "updated_at": "2026-10-10T15:00:00Z",
    "is_sample": true
  },
  {
    "id": "30000000-0000-4000-8000-000000000003",
    "slug": "turning-plans-into-power",
    "author_name": "Maya Patel",
    "final_body": "CHAMPAIGN, Ill.\n\nClean energy can sound like a conversation happening somewhere else, between distant power plants and enormous spreadsheets. But part of the work is close enough to see from a sidewalk: a roof, a public building, a parking area with room for shade.\n\nThe question is how a promising idea becomes something that actually gets built.\n\n## What stands between a good idea and a working project?\n\nBefore celebrating a solar proposal, ask about the steps ahead. Who owns the site? How will the project connect to the grid? Which approvals does it need? Who will maintain it after the ribbon is cut?\n\nClear answers do not eliminate every tradeoff. They do make it easier to tell the difference between a necessary safeguard and a process nobody can explain.\n\nLocal institutions can help by making those steps visible. A plain language project timeline, a named contact, and an honest explanation of delays would give the community something concrete to follow.\n\nStudents can bring curiosity to that work. Pick a proposed project, read its public materials, and ask which decision comes next. Then keep asking until the path is understandable.\n\nAn abundant energy future needs invention. It also needs patient attention to the ordinary decisions that turn plans into power.",
    "headline": "Good energy ideas deserve a clear path forward.",
    "short_version": "A clean energy future is built one project at a time. Understanding the next approval can be a useful place to start.",
    "sources": [],
    "topic_id": "10000000-0000-4000-8000-000000000003",
    "byline": "Maya Patel",
    "writer_id": "20000000-0000-4000-8000-000000000001",
    "cover_url": null,
    "cover_alt": null,
    "published_at": "2026-10-09T15:00:00Z",
    "updated_at": "2026-10-09T15:00:00Z",
    "is_sample": true
  },
  {
    "id": "30000000-0000-4000-8000-000000000004",
    "slug": "care-within-reach",
    "author_name": "Theo Brooks",
    "final_body": "CHAMPAIGN, Ill.\n\nWhen you need care, the first task should not be figuring out a maze. Yet even a routine appointment can involve several smaller problems: finding the right office, understanding the cost, arranging transportation, and choosing a time you can make.\n\nA service can exist on paper while remaining difficult to use in practice. That gap deserves attention.\n\n## What would easier access feel like?\n\nStart with the first question a student might ask: where do I go? A useful guide would explain what a service offers, who can use it, how to contact it, and where to find current information about payment. It would also say when the guide was checked.\n\nThen look beyond the directory. Are appointment instructions clear? Can someone understand the next step without making several calls? Is there a practical way to get there?\n\nThese questions do not replace the need for enough clinicians and appointments. They help us understand how that capacity reaches people.\n\nA student group could begin by reviewing public information with the organizations that provide care. Ask them what people misunderstand and what would make a referral easier.\n\nWe should judge access by the experience of reaching care, not simply by whether an address appears on a list.",
    "headline": "Care should be within reach.",
    "short_version": "An address in a directory is only the beginning. Easier access means clearer information, practical trips, and enough appointments.",
    "sources": [],
    "topic_id": "10000000-0000-4000-8000-000000000004",
    "byline": "Theo Brooks",
    "writer_id": "20000000-0000-4000-8000-000000000002",
    "cover_url": null,
    "cover_alt": null,
    "published_at": "2026-10-08T15:00:00Z",
    "updated_at": "2026-10-08T15:00:00Z",
    "is_sample": true
  },
  {
    "id": "30000000-0000-4000-8000-000000000005",
    "slug": "places-to-keep-learning",
    "author_name": "Maya Patel",
    "final_body": "CHAMPAIGN, Ill.\n\nA good place to learn offers more than a desk. It gives you somewhere to ask a question, find a useful book, charge a laptop, or work alongside someone who knows a different way to solve a problem.\n\nAround a university, it is easy to forget that access to those places is not automatic for everyone.\n\n## Who gets a place at the table?\n\nThink about a learning space from the perspective of someone arriving for the first time. Can they tell whether they are welcome? Do they know the opening hours? Is the entrance easy to find? Can they get there without a car?\n\nSmall details shape whether a public resource feels public. Clear signs and straightforward information matter alongside the larger questions of staffing, space, and funding.\n\nStudents can help by connecting what they know with what neighbors want to learn. A workshop should start with a conversation about useful topics, a realistic schedule, and who will keep the effort going.\n\nThere is room for practical ambition here: more welcoming study spaces, better connections between campus and community, and learning opportunities designed around ordinary lives.\n\nEducation does not end at the classroom door. A community can build more places where curiosity has somewhere to go.",
    "headline": "A city with more places to learn.",
    "short_version": "Curiosity does not stop at the classroom door. Welcoming public spaces can give it somewhere else to go.",
    "sources": [],
    "topic_id": "10000000-0000-4000-8000-000000000005",
    "byline": "Maya Patel",
    "writer_id": "20000000-0000-4000-8000-000000000001",
    "cover_url": null,
    "cover_alt": null,
    "published_at": "2026-10-07T15:00:00Z",
    "updated_at": "2026-10-07T15:00:00Z",
    "is_sample": true
  },
  {
    "id": "30000000-0000-4000-8000-000000000006",
    "slug": "public-tools-that-work",
    "author_name": "Theo Brooks",
    "final_body": "CHAMPAIGN, Ill.\n\nYou should not need to understand an organization chart to report a broken sidewalk. A public website earns its keep when it helps someone finish an ordinary task and understand what happens next.\n\nThat sounds modest. It is also a useful way to judge technology that promises to make government better.\n\n## Can a simpler form make a real difference?\n\nImagine opening a service request on your phone. The page explains what information is needed, lets you describe the location, and gives you a clear confirmation. Later, you can check whether the request has reached the right team.\n\nThe hardest part may happen behind the screen. Someone needs responsibility for the request. Departments need a way to pass it along. The public needs an honest explanation when work will take time.\n\nGood software cannot substitute for that organization. It can make the process easier to see and improve.\n\nStudents who want to help can begin with a small audit: choose a common public task, try it with a keyboard and a phone, and note every confusing step. Share specific observations without collecting anyone's personal information.\n\nUseful civic technology starts with the person trying to get something done. The most impressive feature might be a clear next step.",
    "headline": "What if the next step was the easy part?",
    "short_version": "Public technology should help people finish everyday tasks. A clear form is a start, and a clear process is what makes it work.",
    "sources": [],
    "topic_id": "10000000-0000-4000-8000-000000000006",
    "byline": "Theo Brooks",
    "writer_id": "20000000-0000-4000-8000-000000000002",
    "cover_url": null,
    "cover_alt": null,
    "published_at": "2026-10-06T15:00:00Z",
    "updated_at": "2026-10-06T15:00:00Z",
    "is_sample": true
  }
];

export const sampleEvents: Event[] = [
  {
    "id": "40000000-0000-4000-8000-000000000001",
    "slug": "making-room-housing-teach-in",
    "title": "Making room: a housing teach in",
    "description": "Bring your questions about homes, neighborhoods, and the rules that shape them. We will read a simple zoning map together and talk about what a more welcoming Champaign Urbana could look like. This is a sample event, not an announced gathering.",
    "starts_at": "2026-10-22T23:00:00Z",
    "ends_at": "2026-10-23T00:30:00Z",
    "location": "Campus location to be announced",
    "rsvp_url": null,
    "recap_post_id": null,
    "is_published": true,
    "is_sample": true
  },
  {
    "id": "40000000-0000-4000-8000-000000000002",
    "slug": "getting-there-transit-teach-in",
    "title": "Getting there should be easier",
    "description": "A conversation about frequent buses, comfortable walking routes, and the small gaps that make a trip feel difficult. Bring a route you take and an idea you would like to explore. This is a sample event, not an announced gathering.",
    "starts_at": "2026-11-06T00:00:00Z",
    "ends_at": "2026-11-06T01:30:00Z",
    "location": "Campus location to be announced",
    "rsvp_url": null,
    "recap_post_id": null,
    "is_published": true,
    "is_sample": true
  }
];

export const sampleLearnPages: LearnPage[] = [
  {
    "id": "50000000-0000-4000-8000-000000000001",
    "slug": "what-is-zoning",
    "title": "What is zoning?",
    "short_version": "The local rules that help decide what can be built and where.",
    "body": "Zoning is a set of local rules about how land can be used. A zoning map divides a community into areas, and a written code explains what is allowed in each one.\n\nThose rules can shape the kinds of buildings on a block, their height, how far they sit from the street, and whether homes and shops can share a neighborhood. Other rules and approvals can matter too.\n\n## Why should a student care?\n\nThe places you can live, the walk to a grocery store, and the kinds of businesses near your apartment are partly shaped by decisions made before you arrived. Learning the vocabulary helps you participate in the next decision.\n\nZoning is not the only thing that determines whether something gets built. Construction costs, financing, infrastructure, and the needs of a property owner also matter.\n\n## Where do I begin?\n\nPick a familiar address. Find the official zoning map for the city it is in, then read the description of its district. Write down anything you do not understand. City planning staff can help explain how the rules apply.\n\nTreat this as a starting point. Always check the current official code before relying on a rule for a real project.",
    "is_published": true,
    "is_sample": true,
    "created_at": "2026-10-01T15:00:00Z",
    "updated_at": "2026-10-01T15:00:00Z"
  },
  {
    "id": "50000000-0000-4000-8000-000000000002",
    "slug": "why-is-rent-high",
    "title": "Why is rent high?",
    "short_version": "A starting point for thinking about homes, demand, and the choices renters face.",
    "body": "Rent is the price of access to a home. It reflects many things, including how many people want to live in an area, the homes available to them, and the costs of owning and maintaining those homes.\n\nA place with jobs, classes, shops, and good transportation can attract more people. If there are not enough suitable homes, renters may have fewer choices and less room to negotiate.\n\n## Is building more the whole answer?\n\nMore homes can give people more options, but the details matter. A household also needs a home it can afford, in a place it can reach, with conditions that are safe and reliable.\n\nRules about what can be built are one part of the picture. Tenant protections, assistance for people with low incomes, infrastructure, construction costs, and access to financing can matter too.\n\n## What can we ask locally?\n\nAsk which kinds of homes are difficult to build and why. Ask what renters are experiencing. Look for current evidence about vacancies, costs, and new construction instead of treating an anecdote as the whole story.\n\nA useful housing conversation starts with the goal: more people able to find a good home, with enough choice to build a life around it.",
    "is_published": true,
    "is_sample": true,
    "created_at": "2026-10-01T15:00:00Z",
    "updated_at": "2026-10-01T15:00:00Z"
  },
  {
    "id": "50000000-0000-4000-8000-000000000003",
    "slug": "who-decides-what-gets-built",
    "title": "Who decides what gets built?",
    "short_version": "Follow an idea from a proposal to a public decision.",
    "body": "A new building often involves several kinds of decisions. A property owner proposes something, staff review the relevant rules, and a public body may consider an approval. The exact route depends on the proposal and the local process.\n\nSome projects can proceed under existing rules. Others need a change or a special approval. Finding out which situation applies is a good first question.\n\n## Where does the public fit in?\n\nPublic meetings can create opportunities to learn about a proposal and offer comments. Meeting materials often explain what decision is actually being considered. Read those materials before deciding what to ask for.\n\nA comment is more useful when it connects a specific concern to an action the body can take. Explain your experience, ask a clear question, and follow the current speaking rules.\n\n## How can I follow a proposal?\n\nStart with the official agenda. Find the staff report or other attached materials. Note the next decision and which body is responsible for it. If something is unclear, contact the office listed on the official page.\n\nProcedures and schedules can change. Use the current official meeting notice for time, place, access details, and opportunities to speak.",
    "is_published": true,
    "is_sample": true,
    "created_at": "2026-10-01T15:00:00Z",
    "updated_at": "2026-10-01T15:00:00Z"
  }
];

export const sampleMeetings: Meeting[] = [
  {
    "id": "60000000-0000-4000-8000-000000000001",
    "body_name": "Example city council meeting",
    "starts_at": "2026-10-21T00:00:00Z",
    "location": "Sample listing. Check the official meeting calendar before attending.",
    "agenda_url": null,
    "is_published": true,
    "is_sample": true
  },
  {
    "id": "60000000-0000-4000-8000-000000000002",
    "body_name": "Example planning meeting",
    "starts_at": "2026-10-22T00:00:00Z",
    "location": "Sample listing. Check the official meeting calendar before attending.",
    "agenda_url": null,
    "is_published": true,
    "is_sample": true
  },
  {
    "id": "60000000-0000-4000-8000-000000000003",
    "body_name": "Example transit board meeting",
    "starts_at": "2026-10-28T21:00:00Z",
    "location": "Sample listing. Check the official meeting calendar before attending.",
    "agenda_url": null,
    "is_published": true,
    "is_sample": true
  }
];

