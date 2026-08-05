-- GAMES CATALOGUE
CREATE TABLE public.games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT 'gamepad',
  difficulty_label text NOT NULL DEFAULT 'Mixed',
  xp_reward_label text NOT NULL DEFAULT 'Up to 1500 XP',
  is_active boolean NOT NULL DEFAULT true,
  is_coming_soon boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.games TO anon, authenticated;
GRANT ALL ON public.games TO service_role;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Games viewable by everyone" ON public.games FOR SELECT USING (true);
CREATE POLICY "Admins manage games" ON public.games FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- QUESTIONS (answers hidden from ordinary players)
CREATE TABLE public.game_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  question text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  clues jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_answer text NOT NULL,
  difficulty text NOT NULL DEFAULT 'easy',
  category text NOT NULL DEFAULT 'General Bible Knowledge',
  explanation text,
  verse_reference text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_game_questions_game ON public.game_questions(game_id, is_active);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_questions TO authenticated;
GRANT ALL ON public.game_questions TO service_role;
ALTER TABLE public.game_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage questions" ON public.game_questions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- SESSIONS
CREATE TABLE public.game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0,
  questions_answered integer NOT NULL DEFAULT 0,
  correct_answers integer NOT NULL DEFAULT 0,
  incorrect_answers integer NOT NULL DEFAULT 0,
  accuracy numeric(5,2) NOT NULL DEFAULT 0,
  best_streak integer NOT NULL DEFAULT 0,
  duration_seconds integer NOT NULL DEFAULT 0,
  xp_earned integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX idx_game_sessions_user ON public.game_sessions(user_id, completed_at DESC);
CREATE INDEX idx_game_sessions_game ON public.game_sessions(game_id, completed, completed_at DESC);
GRANT SELECT ON public.game_sessions TO authenticated;
GRANT ALL ON public.game_sessions TO service_role;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own sessions" ON public.game_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ANSWERS
CREATE TABLE public.game_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.game_questions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answer text,
  is_correct boolean NOT NULL DEFAULT false,
  response_time_ms integer NOT NULL DEFAULT 0,
  points_earned integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_game_answers_session ON public.game_answers(session_id);
GRANT SELECT ON public.game_answers TO authenticated;
GRANT ALL ON public.game_answers TO service_role;
ALTER TABLE public.game_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own answers" ON public.game_answers FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- LEADERBOARD (security definer, aggregates only public-safe fields)
CREATE OR REPLACE FUNCTION public.game_leaderboard(_period text DEFAULT 'all', _game_slug text DEFAULT NULL)
RETURNS TABLE (user_id uuid, display_name text, avatar_url text, total_xp bigint, best_score integer, games_played bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.user_id,
         COALESCE(p.display_name, 'Friend') AS display_name,
         p.avatar_url,
         SUM(s.xp_earned)::bigint AS total_xp,
         MAX(s.score) AS best_score,
         COUNT(*)::bigint AS games_played
  FROM public.game_sessions s
  LEFT JOIN public.profiles p ON p.id = s.user_id
  JOIN public.games g ON g.id = s.game_id
  WHERE s.completed = true
    AND (_period <> 'week' OR s.completed_at >= now() - interval '7 days')
    AND (_game_slug IS NULL OR g.slug = _game_slug)
  GROUP BY s.user_id, p.display_name, p.avatar_url
  ORDER BY total_xp DESC
  LIMIT 50;
$$;
REVOKE EXECUTE ON FUNCTION public.game_leaderboard(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.game_leaderboard(text, text) TO authenticated;

-- SEED GAMES
INSERT INTO public.games (slug, name, description, icon, difficulty_label, xp_reward_label, is_coming_soon, sort_order) VALUES
('trivia','Bible Trivia','Multiple-choice questions across the whole of Scripture.','brain','Easy - Hard','Up to 1600 XP',false,1),
('true-or-false','True or False','Fast-paced statements. Decide quickly, answer wisely.','scale','Easy - Medium','Up to 1400 XP',false,2),
('character','Guess the Character','Identify the Bible figure from progressive clues.','user-search','Easy - Hard','Up to 1500 XP',false,3),
('complete-verse','Complete the Verse','Fill in the missing word from a well-known verse.','book-open','Easy - Hard','Up to 1500 XP',false,4),
('speed-challenge','Bible Speed Challenge','Answer as many questions as you can before the clock runs out.','timer','Coming soon','TBA',true,10),
('character-matching','Character Matching','Match people to their stories in a memory-style grid.','grid-2x2','Coming soon','TBA',true,11),
('books-challenge','Books of the Bible','Order and name all 66 books against the clock.','library','Coming soon','TBA',true,12),
('guess-verse','Guess the Verse','Name the reference from the passage shown.','quote','Coming soon','TBA',true,13),
('verse-race','Bible Verse Race','Race other believers to finish the verse first.','flag','Coming soon','TBA',true,14),
('geography','Bible Geography','Find the cities, rivers and journeys on the map.','map','Coming soon','TBA',true,15),
('who-am-i','Bible Puzzle / Who Am I?','Piece together the puzzle and reveal the hidden figure.','puzzle','Coming soon','TBA',true,16),
('millionaire','Bible Millionaire','Climb the ladder with lifelines and rising stakes.','crown','Coming soon','TBA',true,17),
('daily-challenge','Daily Bible Challenge','A fresh set of questions every single day.','calendar-check','Coming soon','TBA',true,18),
('weekly-tournament','Weekly Tournament','Compete all week for the top of the table.','trophy','Coming soon','TBA',true,19),
('bible-battles','Bible Battles','Head-to-head live duels with other members.','swords','Coming soon','TBA',true,20);

-- SEED QUESTIONS
WITH g AS (SELECT id, slug FROM public.games)
INSERT INTO public.game_questions (game_id, question, options, clues, correct_answer, difficulty, category, explanation, verse_reference)
SELECT g.id, x.question, x.options::jsonb, x.clues::jsonb, x.correct_answer, x.difficulty, x.category, x.explanation, x.verse_reference
FROM (VALUES
-- TRIVIA (30)
('trivia','Who was swallowed by a great fish?','["Moses","Jonah","Peter","David"]','[]','Jonah','easy','Old Testament','Jonah fled from God and was swallowed by a great fish for three days.','Jonah 1:17'),
('trivia','How many days and nights did it rain during the flood?','["7","12","40","100"]','[]','40','easy','Old Testament','Rain fell on the earth forty days and forty nights.','Genesis 7:12'),
('trivia','Who led the Israelites out of Egypt?','["Aaron","Joshua","Moses","Samuel"]','[]','Moses','easy','Old Testament','God called Moses to bring Israel out of slavery.','Exodus 3:10'),
('trivia','What is the first book of the Bible?','["Exodus","Genesis","Psalms","Job"]','[]','Genesis','easy','General Bible Knowledge','Genesis means beginnings.','Genesis 1:1'),
('trivia','Who baptised Jesus?','["Peter","John the Baptist","Andrew","Elijah"]','[]','John the Baptist','easy','Jesus','John baptised Jesus in the Jordan.','Matthew 3:13'),
('trivia','How many disciples did Jesus choose?','["7","10","12","70"]','[]','12','easy','Jesus','Jesus appointed twelve apostles.','Mark 3:14'),
('trivia','In which town was Jesus born?','["Nazareth","Bethlehem","Jerusalem","Capernaum"]','[]','Bethlehem','easy','Jesus','Jesus was born in Bethlehem of Judea.','Matthew 2:1'),
('trivia','Who denied Jesus three times?','["Judas","Thomas","Peter","John"]','[]','Peter','easy','Bible Characters','Peter denied the Lord before the rooster crowed.','Luke 22:61'),
('trivia','What did God create on the first day?','["Animals","Light","Man","Stars"]','[]','Light','easy','Old Testament','God said, Let there be light.','Genesis 1:3'),
('trivia','Who was the strongest man in the Bible?','["Samson","Saul","Goliath","Gideon"]','[]','Samson','easy','Bible Characters','Samson had great strength from the Lord.','Judges 16:17'),
('trivia','Which sea did Moses part?','["Dead Sea","Red Sea","Sea of Galilee","Mediterranean"]','[]','Red Sea','easy','Miracles','God divided the Red Sea before Israel.','Exodus 14:21'),
('trivia','Who wrote most of the Psalms?','["Solomon","David","Asaph","Moses"]','[]','David','medium','Old Testament','David is credited with about half the psalms.','Psalm 23:1'),
('trivia','Which prophet was taken to heaven in a whirlwind?','["Elisha","Elijah","Isaiah","Enoch"]','[]','Elijah','medium','Prophets','Elijah went up by a whirlwind into heaven.','2 Kings 2:11'),
('trivia','What was the first miracle of Jesus?','["Healing a leper","Water into wine","Walking on water","Feeding 5000"]','[]','Water into wine','medium','Miracles','At Cana Jesus turned water into wine.','John 2:11'),
('trivia','Who was thrown into the lions den?','["Daniel","Shadrach","Jeremiah","Nehemiah"]','[]','Daniel','easy','Old Testament','Daniel was preserved among the lions.','Daniel 6:16'),
('trivia','Which parable speaks of a man beaten and left on the road?','["The Sower","The Good Samaritan","The Lost Coin","The Talents"]','[]','The Good Samaritan','medium','Parables','A Samaritan showed mercy to the wounded man.','Luke 10:33'),
('trivia','How many books are in the Bible?','["27","39","66","73"]','[]','66','medium','General Bible Knowledge','39 Old Testament and 27 New Testament books.','2 Timothy 3:16'),
('trivia','Who succeeded Moses as leader of Israel?','["Caleb","Joshua","Aaron","Gideon"]','[]','Joshua','medium','Old Testament','Joshua led Israel into the promised land.','Joshua 1:2'),
('trivia','What did Jesus feed 5000 people with?','["Manna","Five loaves and two fish","Bread and wine","Seven loaves"]','[]','Five loaves and two fish','easy','Miracles','A boy gave five barley loaves and two fish.','John 6:9'),
('trivia','Who was the first martyr of the church?','["Stephen","James","Paul","Barnabas"]','[]','Stephen','medium','New Testament','Stephen was stoned while praying for his killers.','Acts 7:59'),
('trivia','Which apostle was called the doubter?','["Philip","Thomas","Matthew","Simon"]','[]','Thomas','easy','New Testament','Thomas would not believe until he saw.','John 20:25'),
('trivia','Who interpreted Pharaohs dreams?','["Daniel","Joseph","Moses","Jacob"]','[]','Joseph','easy','Bible Characters','Joseph interpreted the dreams of seven years.','Genesis 41:25'),
('trivia','Which prophet married Gomer?','["Amos","Hosea","Joel","Micah"]','[]','Hosea','hard','Prophets','Hoseas marriage pictured Gods love for Israel.','Hosea 1:3'),
('trivia','What was Pauls name before conversion?','["Silas","Saul","Simeon","Stephen"]','[]','Saul','medium','New Testament','Saul of Tarsus became Paul the apostle.','Acts 13:9'),
('trivia','On which mountain did Moses receive the commandments?','["Mount Carmel","Mount Sinai","Mount Nebo","Mount Zion"]','[]','Mount Sinai','medium','Old Testament','God gave the law on Sinai.','Exodus 19:20'),
('trivia','Who was the mother of John the Baptist?','["Mary","Elizabeth","Anna","Hannah"]','[]','Elizabeth','medium','Bible Characters','Elizabeth bore John in her old age.','Luke 1:57'),
('trivia','Which city walls fell after Israel marched around them?','["Ai","Jericho","Hebron","Gaza"]','[]','Jericho','easy','Old Testament','The walls fell on the seventh day.','Joshua 6:20'),
('trivia','Who was the king that built the first temple?','["David","Solomon","Hezekiah","Josiah"]','[]','Solomon','medium','Old Testament','Solomon built the temple in Jerusalem.','1 Kings 6:1'),
('trivia','Which prophet saw a valley of dry bones?','["Ezekiel","Jeremiah","Zechariah","Daniel"]','[]','Ezekiel','hard','Prophets','The bones came together and lived.','Ezekiel 37:4'),
('trivia','What is the shortest verse in the KJV Bible?','["God is love","Jesus wept","Pray without ceasing","Rejoice evermore"]','[]','Jesus wept','hard','General Bible Knowledge','Two words at the tomb of Lazarus.','John 11:35'),
-- TRUE OR FALSE (20)
('true-or-false','David defeated Goliath.','["True","False"]','[]','True','easy','Old Testament','David felled the giant with a sling and a stone.','1 Samuel 17:50'),
('true-or-false','Noah built an ark to survive the flood.','["True","False"]','[]','True','easy','Old Testament','Noah obeyed Gods instruction exactly.','Genesis 6:22'),
('true-or-false','Jesus had thirteen disciples.','["True","False"]','[]','False','easy','Jesus','He chose twelve.','Mark 3:14'),
('true-or-false','Paul wrote the book of Revelation.','["True","False"]','[]','False','medium','New Testament','John wrote Revelation on Patmos.','Revelation 1:9'),
('true-or-false','Adam and Eve lived in the garden of Eden.','["True","False"]','[]','True','easy','Old Testament','God placed them in Eden.','Genesis 2:8'),
('true-or-false','Moses entered the promised land.','["True","False"]','[]','False','medium','Old Testament','He saw it from Nebo but did not enter.','Deuteronomy 34:4'),
('true-or-false','Solomon asked God for wisdom.','["True","False"]','[]','True','easy','Old Testament','He asked for an understanding heart.','1 Kings 3:9'),
('true-or-false','The book of Psalms is in the New Testament.','["True","False"]','[]','False','easy','General Bible Knowledge','Psalms is an Old Testament book.','Psalm 1:1'),
('true-or-false','Jesus walked on water.','["True","False"]','[]','True','easy','Miracles','He came to the disciples on the sea.','Matthew 14:25'),
('true-or-false','Judas betrayed Jesus for thirty pieces of silver.','["True","False"]','[]','True','easy','Jesus','The chief priests weighed out the silver.','Matthew 26:15'),
('true-or-false','Lazarus was raised from the dead.','["True","False"]','[]','True','easy','Miracles','Jesus called him out of the tomb.','John 11:43'),
('true-or-false','There are four gospels.','["True","False"]','[]','True','easy','New Testament','Matthew, Mark, Luke and John.','John 21:25'),
('true-or-false','Samson lost his strength when his hair was cut.','["True","False"]','[]','True','medium','Bible Characters','His Nazirite vow was broken.','Judges 16:19'),
('true-or-false','Jonah was swallowed by a whale for seven days.','["True","False"]','[]','False','medium','Old Testament','It was three days and three nights.','Jonah 1:17'),
('true-or-false','Peter walked on water toward Jesus.','["True","False"]','[]','True','medium','Miracles','He walked until he saw the wind.','Matthew 14:29'),
('true-or-false','The Ten Commandments were given on Mount Carmel.','["True","False"]','[]','False','medium','Old Testament','They were given on Sinai.','Exodus 19:20'),
('true-or-false','Esther became queen of Persia.','["True","False"]','[]','True','medium','Bible Characters','She saved her people from destruction.','Esther 2:17'),
('true-or-false','Isaiah prophesied about the coming Messiah.','["True","False"]','[]','True','medium','Prophets','Unto us a child is born.','Isaiah 9:6'),
('true-or-false','Matthew was a fisherman before following Jesus.','["True","False"]','[]','False','hard','New Testament','Matthew was a tax collector.','Matthew 9:9'),
('true-or-false','The parable of the prodigal son is found in Luke.','["True","False"]','[]','True','medium','Parables','Luke records the lost son.','Luke 15:11'),
-- CHARACTER (20)
('character','Who am I?','["Moses","David","Saul","Solomon"]','["I was a shepherd boy.","I defeated a giant with a sling.","I became king of Israel."]','David','easy','Bible Characters','David, the shepherd king.','1 Samuel 17:50'),
('character','Who am I?','["Noah","Abraham","Isaac","Lot"]','["God told me to build something huge.","I gathered animals two by two.","I saw a rainbow of promise."]','Noah','easy','Bible Characters','Noah built the ark.','Genesis 9:13'),
('character','Who am I?','["Joseph","Daniel","Nehemiah","Ezra"]','["My brothers sold me.","I wore a coat of many colours.","I ruled in Egypt under Pharaoh."]','Joseph','easy','Bible Characters','Joseph son of Jacob.','Genesis 41:41'),
('character','Who am I?','["Aaron","Moses","Joshua","Caleb"]','["I was hidden in a basket as a baby.","I met God in a burning bush.","I parted the sea with my staff."]','Moses','easy','Bible Characters','Moses the deliverer.','Exodus 14:21'),
('character','Who am I?','["Peter","Paul","James","John"]','["I was a fisherman.","I denied my Lord three times.","I preached at Pentecost."]','Peter','easy','Bible Characters','Simon Peter.','Acts 2:14'),
('character','Who am I?','["Mary","Martha","Elizabeth","Anna"]','["An angel visited me.","I was told I would bear a son.","I called him Jesus."]','Mary','easy','Bible Characters','Mary the mother of Jesus.','Luke 1:31'),
('character','Who am I?','["Daniel","Ezekiel","Jeremiah","Isaiah"]','["I served in Babylon.","I prayed three times a day.","I spent a night with lions."]','Daniel','medium','Bible Characters','Daniel in the lions den.','Daniel 6:16'),
('character','Who am I?','["Samson","Gideon","Jephthah","Deborah"]','["I judged Israel.","My strength was in my hair.","I brought down a temple."]','Samson','medium','Bible Characters','Samson the judge.','Judges 16:30'),
('character','Who am I?','["Ruth","Naomi","Rachel","Leah"]','["I was a Moabite widow.","I refused to leave my mother in law.","I married Boaz."]','Ruth','medium','Bible Characters','Ruth, ancestor of David.','Ruth 4:13'),
('character','Who am I?','["Elijah","Elisha","Samuel","Nathan"]','["I confronted the prophets of Baal.","Fire fell at my prayer.","I was taken up in a whirlwind."]','Elijah','medium','Prophets','Elijah the Tishbite.','2 Kings 2:11'),
('character','Who am I?','["Paul","Barnabas","Timothy","Silas"]','["I persecuted the church.","I was blinded on a road.","I wrote many letters to churches."]','Paul','medium','Bible Characters','Paul the apostle.','Acts 9:4'),
('character','Who am I?','["Abraham","Isaac","Jacob","Joseph"]','["God promised me descendants like the stars.","I left my country at Gods word.","I was ready to offer my son."]','Abraham','medium','Bible Characters','Abraham, father of faith.','Genesis 22:10'),
('character','Who am I?','["Solomon","Rehoboam","Hezekiah","Josiah"]','["I asked God for wisdom.","I built the temple.","I wrote many proverbs."]','Solomon','medium','Bible Characters','Solomon the wise.','1 Kings 3:12'),
('character','Who am I?','["John the Baptist","Andrew","Philip","Stephen"]','["I lived in the wilderness.","I ate locusts and wild honey.","I baptised the Messiah."]','John the Baptist','medium','Bible Characters','The forerunner.','Matthew 3:4'),
('character','Who am I?','["Esther","Ruth","Deborah","Miriam"]','["I was an orphan raised by my cousin.","I became a queen.","I risked my life for my people."]','Esther','medium','Bible Characters','Queen Esther.','Esther 4:16'),
('character','Who am I?','["Deborah","Jael","Miriam","Hannah"]','["I was a prophetess and judge.","I sat under a palm tree.","I went to battle with Barak."]','Deborah','hard','Bible Characters','Deborah the judge.','Judges 4:4'),
('character','Who am I?','["Nehemiah","Ezra","Zerubbabel","Haggai"]','["I was cupbearer to a king.","I wept over a ruined city.","I rebuilt the walls of Jerusalem."]','Nehemiah','hard','Bible Characters','Nehemiah the builder.','Nehemiah 6:15'),
('character','Who am I?','["Jonah","Amos","Nahum","Obadiah"]','["I ran from Gods calling.","I was thrown into the sea.","I preached to Nineveh."]','Jonah','easy','Prophets','Jonah the reluctant prophet.','Jonah 3:4'),
('character','Who am I?','["Zacchaeus","Nicodemus","Jairus","Lazarus"]','["I was a wealthy tax collector.","I was short in stature.","I climbed a tree to see Jesus."]','Zacchaeus','medium','Bible Characters','Zacchaeus of Jericho.','Luke 19:4'),
('character','Who am I?','["Stephen","Philip","Barnabas","Silas"]','["I was one of the seven chosen to serve.","I preached boldly before the council.","I was stoned and saw heaven opened."]','Stephen','hard','Bible Characters','Stephen the first martyr.','Acts 7:56'),
-- COMPLETE THE VERSE (20)
('complete-verse','For God so loved the ______ that he gave his only begotten Son.','["Church","World","People","Nation"]','[]','World','easy','New Testament','The love of God reaches the whole world.','John 3:16'),
('complete-verse','The Lord is my ______; I shall not want.','["Shield","Shepherd","Refuge","Rock"]','[]','Shepherd','easy','Old Testament','David pictures God as a shepherd.','Psalm 23:1'),
('complete-verse','I can do all things through ______ which strengtheneth me.','["Faith","Christ","Prayer","Love"]','[]','Christ','easy','New Testament','Pauls confidence was in Christ.','Philippians 4:13'),
('complete-verse','In the beginning God created the heaven and the ______.','["Earth","Sea","Light","Stars"]','[]','Earth','easy','Old Testament','The opening line of Scripture.','Genesis 1:1'),
('complete-verse','Trust in the Lord with all thine ______.','["Mind","Heart","Soul","Strength"]','[]','Heart','easy','Old Testament','Wholehearted trust, not our own understanding.','Proverbs 3:5'),
('complete-verse','Thy word is a ______ unto my feet.','["Lamp","Light","Path","Guide"]','[]','Lamp','medium','Old Testament','Scripture guides our steps.','Psalm 119:105'),
('complete-verse','Come unto me, all ye that labour and are heavy laden, and I will give you ______.','["Peace","Rest","Joy","Life"]','[]','Rest','easy','Jesus','Jesus invites the weary.','Matthew 11:28'),
('complete-verse','The ______ of the Lord is the beginning of wisdom.','["Word","Fear","Love","Way"]','[]','Fear','medium','Old Testament','Reverence begins true wisdom.','Proverbs 9:10'),
('complete-verse','Freely ye have received, freely ______.','["Serve","Give","Love","Go"]','[]','Give','medium','Jesus','The mission verse of this app.','Matthew 10:8'),
('complete-verse','But they that wait upon the Lord shall renew their ______.','["Hope","Strength","Faith","Spirit"]','[]','Strength','medium','Prophets','They mount up with wings as eagles.','Isaiah 40:31'),
('complete-verse','I am the way, the truth, and the ______.','["Light","Life","Door","Vine"]','[]','Life','easy','Jesus','No man comes to the Father but by him.','John 14:6'),
('complete-verse','And we know that all things work together for ______ to them that love God.','["Good","Glory","Peace","Grace"]','[]','Good','medium','New Testament','A promise for the called.','Romans 8:28'),
('complete-verse','Be still, and know that I am ______.','["Holy","God","Lord","Near"]','[]','God','easy','Old Testament','A call to quiet confidence.','Psalm 46:10'),
('complete-verse','For the wages of sin is ______.','["Shame","Death","Sorrow","Loss"]','[]','Death','medium','New Testament','But the gift of God is eternal life.','Romans 6:23'),
('complete-verse','Let your ______ so shine before men.','["Light","Faith","Word","Love"]','[]','Light','medium','Jesus','That they may see your good works.','Matthew 5:16'),
('complete-verse','The joy of the Lord is your ______.','["Song","Strength","Portion","Shield"]','[]','Strength','medium','Old Testament','Nehemiah encouraged the people.','Nehemiah 8:10'),
('complete-verse','Greater is he that is in you, than he that is in the ______.','["World","Flesh","Night","Storm"]','[]','World','hard','New Testament','Assurance for believers.','1 John 4:4'),
('complete-verse','Ask, and it shall be given you; ______, and ye shall find.','["Knock","Seek","Pray","Wait"]','[]','Seek','medium','Jesus','Persistent prayer is rewarded.','Matthew 7:7'),
('complete-verse','A soft answer turneth away ______.','["Wrath","Envy","Pride","Harm"]','[]','Wrath','hard','Old Testament','Gentle words calm anger.','Proverbs 15:1'),
('complete-verse','If we confess our sins, he is faithful and just to ______ us our sins.','["Cleanse","Forgive","Free","Heal"]','[]','Forgive','medium','New Testament','And to cleanse us from all unrighteousness.','1 John 1:9')
) AS x(slug, question, options, clues, correct_answer, difficulty, category, explanation, verse_reference)
JOIN g ON g.slug = x.slug;