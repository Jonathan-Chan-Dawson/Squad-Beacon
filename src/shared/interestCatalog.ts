export type InterestSubcategory = {
  name: string;
  interests: string[];
};

export type InterestCategory = {
  name: string;
  subcategories: InterestSubcategory[];
};

// A browsable starter catalog. Free-form interests remain supported so the
// catalog can help people find language without limiting how they describe
// themselves.
const groups: [string, string, string, string, string, string, string, string, string][] = [
  ["Sports", "Team sports", "Basketball|Soccer|Volleyball|Baseball|Softball|Football|Rugby|Hockey|Cricket|Lacrosse", "Racquet sports", "Tennis|Pickleball|Badminton|Squash|Table tennis|Platform tennis", "Endurance sports", "Running races|Cycling races|Triathlon|Swimming|Rowing|Cross-country skiing", "Combat & precision", "Boxing|Martial arts|Wrestling|Fencing|Archery|Sport shooting"],
  ["Fitness", "Strength", "Weight training|Powerlifting|Olympic lifting|Bodyweight training|Kettlebells|Functional fitness", "Movement", "Yoga|Pilates|Barre|Dance fitness|Mobility|Stretching", "Cardio", "Running|Walking|Indoor cycling|Jump rope|Swimming laps|Aerobics", "Wellbeing", "Mindful movement|Recovery|Breathwork|Healthy routines|Personal training|Group classes"],
  ["Outdoors", "Hiking & camping", "Day hiking|Backpacking|Camping|Climbing|Bouldering|Trail running", "Water & snow", "Kayaking|Canoeing|Paddleboarding|Surfing|Sailing|Snowboarding|Skiing", "Nature", "Birdwatching|Gardening|Wildlife watching|Stargazing|Fishing|Foraging", "Adventure", "Mountain biking|Scuba diving|Rock climbing|Geocaching|Outdoor photography|Horseback riding"],
  ["Gaming", "Video games", "Cozy games|Role-playing games|Strategy games|Fighting games|Sports games|Simulation games|Indie games|Puzzle games", "Tabletop", "Board games|Card games|Trading card games|Tabletop role-playing|Miniature games|Chess", "Play style", "Casual gaming|Competitive gaming|Co-op games|Speedrunning|Game streaming|Retro gaming", "Making games", "Game design|Game development|Esports|Game modding|Gaming events|Arcade games"],
  ["Music", "Listening", "Pop|Hip-hop|R&B|Rock|Indie|Jazz|Classical|Electronic|Country|Metal|Folk|K-pop", "Making music", "Singing|Songwriting|Guitar|Piano|Drums|Bass|Violin|DJing", "Live music", "Concerts|Music festivals|Open mic nights|Choir|Jam sessions|Local bands", "Learning & collecting", "Music theory|Music production|Vinyl collecting|Music history|Beat making|Sound design"],
  ["Arts", "Visual arts", "Drawing|Painting|Watercolor|Illustration|Printmaking|Sculpture|Ceramics|Photography", "Writing & stories", "Creative writing|Poetry|Journaling|Screenwriting|Comics|Book clubs", "Stage & screen", "Theater|Acting|Film|Animation|Dance|Improv|Documentaries", "Crafts & design", "Knitting|Crochet|Sewing|Woodworking|Graphic design|Interior design|Floristry"],
  ["Technology", "Building", "Programming|Web development|App development|Robotics|Electronics|3D printing", "Digital life", "Artificial intelligence|Cybersecurity|Open source|Data science|Cloud computing|Blockchain", "Creative tech", "Game development|Digital art|Music technology|Virtual reality|User experience design|Creative coding", "Community & learning", "Tech meetups|Startup technology|Science fiction|Tech volunteering|Product design|Computer hardware"],
  ["Education", "Learning", "Languages|Mathematics|Science|History|Philosophy|Psychology|Astronomy", "Study life", "Study groups|Accountability sessions|Test preparation|Online courses|Lifelong learning|Research", "Sharing knowledge", "Tutoring|Mentoring|Teaching|Public speaking|Workshops|Book discussions", "Skills", "Personal finance|First aid|Sign language|Writing skills|Career development|Digital literacy"],
  ["Food", "Cooking", "Home cooking|Baking|Bread making|Meal prep|Grilling|Vegetarian cooking|Vegan cooking", "Food culture", "Coffee|Tea|Wine|Craft beer|Fermentation|Food history|Local restaurants", "Eating styles", "Plant-based food|Gluten-free cooking|Halal food|Kosher food|Nutrition|Food allergies awareness", "Exploring flavors", "Food markets|Street food|Desserts|Regional cuisine|Food photography|Restaurant discovery"],
  ["Social", "Getting together", "Coffee chats|Dinner parties|Game nights|Picnics|Brunch|Movie nights", "Meeting people", "Making new friends|Small groups|Social clubs|Community events|Conversation practice|Networking", "Shared moments", "Celebrating milestones|Hosting friends|Weekend plans|Family activities|Group challenges|Local hangouts", "Connection style", "One-on-one conversations|Quiet gatherings|Big events|Online communities|Intergenerational activities|Friendship building"],
  ["Travel", "Trip style", "Road trips|Weekend getaways|Backpacking trips|Solo travel|Group travel|Train travel", "Places", "National parks|Beaches|Mountains|Small towns|Big cities|Historic places", "Travel interests", "Cultural travel|Food travel|Adventure travel|Slow travel|Accessible travel|Photography trips", "Planning & sharing", "Travel planning|Travel tips|Travel journaling|Local guides|Language exchange|Travel meetups"],
  ["Business", "Building things", "Entrepreneurship|Small business|Startups|Side projects|Social enterprise|Product building", "Work & craft", "Leadership|Design thinking|Marketing|Sales|Project management|Public relations", "Money & markets", "Personal finance|Investing basics|Economics|Real estate|Financial literacy|Career growth", "Professional community", "Mentorship|Coworking|Founder meetups|Women in business|Freelancing|Professional development"],
  ["Cars / Motorsports", "On the road", "Car culture|Road trips|Electric vehicles|Classic cars|Off-roading|Car camping", "Motorsports", "Formula racing|Rally|Karting|Motorcycle racing|Drag racing|Motocross", "Hands-on", "Car maintenance|Auto restoration|Detailing|Motorcycle riding|DIY repairs|Automotive design", "Community", "Car meets|Motorcycle meetups|Auto shows|Sim racing|Overlanding|Motorsports photography"],
  ["Fashion", "Personal style", "Streetwear|Vintage fashion|Minimalist style|Sustainable fashion|Thrift shopping|Sneakers", "Making & design", "Fashion design|Sewing|Textile arts|Jewelry making|Costume design|Fashion illustration", "Beauty & care", "Skincare|Makeup|Hair styling|Nail art|Fragrance|Barbering", "Fashion community", "Style swaps|Fashion shows|Personal styling|Fashion history|Secondhand fashion|Wardrobe building"],
  ["Animals", "Companions", "Dogs|Cats|Birds|Fish|Rabbits|Reptiles", "Animal care", "Dog training|Pet fostering|Pet rescue|Animal behavior|Pet photography|Veterinary science", "Wildlife", "Conservation|Birding|Marine life|Native plants and wildlife|Wildlife photography|Animal sanctuaries", "Activities", "Horse riding|Dog walking|Agility training|Aquariums|Farm animals|Animal volunteering"],
  ["Culture / Languages", "Languages", "Spanish|French|Mandarin|American Sign Language|Arabic|Japanese|Korean|German|Portuguese|Hindi", "Culture", "Cultural exchange|Heritage|World history|Folklore|Museums|Local traditions", "Arts & media", "World cinema|International music|Global literature|Cultural festivals|Dance traditions|Food traditions", "Connecting", "Language exchange|Multilingual families|Travel conversation|Translation|Cross-cultural friendship|Diaspora communities"],
  ["Community", "Helping out", "Food banks|Community gardens|Neighborhood cleanup|Animal shelters|Youth mentoring|Mutual aid", "Civic life", "Local government|Community organizing|Public spaces|Housing access|Environmental action|Voter education", "Care & support", "Accessibility|Mental health advocacy|Peer support|Caregiving|Disability inclusion|Youth programs", "Local belonging", "Neighborhood events|Community arts|Library programs|Volunteer groups|Faith communities|Cultural organizations"],
  ["Other", "Ideas & discovery", "Science|Space|History|Trivia|Podcasts|Documentaries", "Everyday interests", "Collecting|Puzzles|Personal growth|Home projects|Minimalism|Organization", "Ways to unwind", "Meditation|Reading|Sauna|Tea time|Nature walks|Mindfulness", "Something else", "Trying new things|Skill sharing|Local discoveries|Creative experiments|Curiosity|Custom interest"],
];

export const INTEREST_CATALOG: InterestCategory[] = groups.map(
  ([name, sub1, list1, sub2, list2, sub3, list3, sub4, list4]) => ({
    name,
    subcategories: [
      { name: sub1, interests: list1.split("|") },
      { name: sub2, interests: list2.split("|") },
      { name: sub3, interests: list3.split("|") },
      { name: sub4, interests: list4.split("|") },
    ],
  }),
);

export const INTERESTS: string[] = [
  ...new Set(
    INTEREST_CATALOG.flatMap((category) =>
      category.subcategories.flatMap((subcategory) => subcategory.interests),
    ),
  ),
];

export const IDENTITY_CATALOG: { name: string; tags: string[] }[] = [
  {
    name: "Personality",
    tags: ["Introvert", "Extrovert", "Ambivert", "Curious", "Easygoing", "Thoughtful", "Adventurous", "Creative", "Myers-Briggs fan", "Personality type: INFP", "Personality type: ENFP", "Personality type: INFJ", "Personality type: ENFJ", "Personality type: INTP", "Personality type: ENTP", "Personality type: INTJ", "Personality type: ENTJ", "Personality type: ISFP", "Personality type: ESFP", "Personality type: ISFJ", "Personality type: ESFJ", "Personality type: ISTP", "Personality type: ESTP", "Personality type: ISTJ", "Personality type: ESTJ"],
  },
  {
    name: "Food & diet",
    tags: ["Omnivore", "Vegetarian", "Vegan", "Pescatarian", "Halal", "Kosher", "Gluten-free", "Dairy-free", "Nut-free", "Plant-based", "Low-waste cooking"],
  },
  {
    name: "Languages",
    tags: ["English speaker", "Spanish speaker", "French speaker", "Mandarin speaker", "American Sign Language", "Arabic speaker", "Japanese speaker", "Korean speaker", "German speaker", "Portuguese speaker", "Hindi speaker", "Learning a language", "Multilingual"],
  },
  {
    name: "Life & community",
    tags: ["Student", "Parent", "Caregiver", "Remote worker", "Small business owner", "Volunteer", "First-generation", "New to town", "Neurodivergent", "LGBTQ+", "Faith is important to me", "Prefer not to label"],
  },
];
