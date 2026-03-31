# Reflex - Product Deep Dive Transcript

> This is the original transcript from the team's product discussion that explains the Reflex concept, market opportunity, technical architecture, and business model.

---

Picture a mid-size oil refinery. Just you know, visualize it. You are looking at this sprawling multi-million-dollar complex of steel and heat and pressure, millions of gallons of volatile liquids through pipes every single day.
It's an incredibly intense environment.
Right. The stakes are so high, the engineering is precise, and you would probably assume the software running the whole show is some futuristic autonomous supercomputer. But today, we are taking a deep dive into an internal product outline for a strategic software platform called Reflex.
And what it reveals is, well, it's frankly astonishing.
Exactly. It reveals this massive, almost unbelievable secret about how these industrial giants actually operate. Okay, let's unpack this. There is a team of people at most of these facilities whose entire job is to figure out the most profitable way to run the plant today.
Yeah, the optimization team.
Right. And at a staggering number of plants, that hyper-complex optimization math, it literally lives in a Microsoft Excel spreadsheet.
It really is a startling juxtaposition when you think about it. I mean you have this incredibly sophisticated continuous physical process operating at hundreds of degrees, but the operational math, the actual brain of the profitability, is completely disconnected from the live reality of the plant.
It's wild.
It is. Our mission in this deep dive is to explore exactly how this disconnect happens, you know, why it's costing mid-size refineries a massive amount of money every single day, and how a remarkably lightweight workflow tool called Reflex is aiming to capture what is essentially a 180 million dollar opportunity.
180 million, just sitting there.
Sitting right there. And while we will be unpacking AI and complex optimization models today, the core story here isn't really about inventing new math. It's about solving human friction and communication bottlenecks.
Okay, so before we get into how a new tool fixes this, we really need to understand the daily reality for these folks. We are talking about the LP planning team. What exactly are they doing on, say, a random Tuesday morning, and what is an LP?
Sure, so LP stands for linear program. It's a mathematical optimization model used to find the best possible outcome given a very specific set of constraints.
Like a giant puzzle.
Exactly. Yeah. In the refining world, that objective is always maximizing margin. You can kind of think of it as the ultimate roadmap for plant operations. You feed it all your inputs, the real-time costs of crude oil, the current capacities of your equipment, the market prices for every refined product you can make.
Right.
And then the LP calculates exactly how much of each product to make, at what rate, and on which processing units, to generate the absolute maximum profit.
I like to think of this like having Google Maps for the refinery. You know, you input the road conditions, which are your equipment capacities, and the destination, which is maximum profit, and it just spits out the absolute optimal route to get there.
That's a great way to put it. And the math itself is blazingly fast. Once the model is set up, it solves in seconds.
So the math isn't the problem.
Not at all. The math isn't the problem at all. The bottleneck is entirely in the workflow surrounding the math. Because the live data isn't automatically fed into the model, the LP planner has to start their morning manually pulling process data from a bunch of different systems.
Wait, manually?
Manually. They are pulling from the historian, which is the massive industrial time-series database storing every single sensor reading from the plant, along with, you know, production reports and market pricing feeds. They take all that disparate data and they physically type it into their Excel spreadsheet.
That is, I mean it's like having a state-of-the-art navigation app on your phone, but you only update your location once a day by manually typing in your latitude and longitude. By the time it tells you to turn, you've already missed the exit.
Yeah, that's exactly what's happening. And after they type it all in, they rerun the model, interpret the results to see what changed from yesterday, and then they write up an email to the operations team with a recommendation.
An email.
It's just a standard email. Because this manual process takes so much time and effort, the cycle time is, at best, once a day. And honestly, sometimes it's only done weekly.
But the market doesn't wait a day or a week. I mean the crack spread, which is the margin between the crude oil input costs and the refined product prices, that fluctuates constantly.
Oh, continuously. Crude prices move, equipment conditions change. So the recommendation they sent at 8:00 AM might be completely wrong by noon.
Totally wrong. But because there is no automated trigger to rerun the math, nobody does. The plant just keeps operating on stale instructions. And the financial impact of this is continuous. The gap between what the mathematical model recommends and what the plant actually does is measured in dollars per barrel, every single hour of every single day.
That adds up so fast.
It does. And worst of all, because the system is so disconnected, nobody is even measuring how much money they are actually losing in that gap.
Okay, this brings me to a huge question. If this manual workflow is so incredibly outdated and, frankly, costly, why hasn't existing enterprise software fixed it? Surely there is a tech giant out there selling a solution to run refineries.
Well, enterprise real-time optimization software, or RTO, definitely exists. Platforms like Aspen PIMS or Honeywell RPMS do handle this kind of continuous optimization.
Right.
But they are massive, heavy, incredibly complex platforms. The software licensing alone costs between 300,000 and 800,000 dollars a year.
Whoa.
Yeah. And on top of that, you can't just install it and walk away. You need dedicated optimization engineers on staff just to run and maintain it. Your total cost of ownership easily exceeds 1 million dollars a year.
Wow. Okay, so the top 20 massive global refiners can easily justify that million-dollar price tag. But there are what, 60 to 80 mid-size US refinery plants producing between 50,000 and 200,000 barrels per day that simply cannot justify that kind of software spend.
Exactly. If we connect this to the bigger picture, it explains the exact market dynamic we are looking at. It is an entirely underserved mid-market. And it extends beyond just US refineries.
Oh, really?
Yeah, there is a similar footprint in Europe and Canada, plus specialty chemical plants and fuel blenders who have the exact same problem. They are entirely priced out of the enterprise RTO market.
Wait, let me push back on this a bit. Are these mid-size refiners just naive, or like, resisting technology? Do they just prefer doing it the old-fashioned way with whiteboards and clipboards?
Not at all, and that is a crucial distinction to make. These teams are highly sophisticated. They have complex LP models that they have spent years, sometimes decades, fine-tuning to perfectly map their specific plant.
Okay, so they know what they're doing.
They have brilliant planning teams. They are not lacking in operational intelligence. They simply lack a software tool that is priced and scaled for their specific economic reality. They are forced to rely on Excel because it is literally the only viable container they have for their math.
Got it. So if they are ditching the manual data entry, how does Reflex actually grab the steering wheel without breaking a billion-dollar plant?
Well, Reflex connects directly to the plant's process historian, ideally through an integration layer like Seeq, and it watches the top hundred or so process constraints in real-time.
Okay.
Simultaneously, it connects to live market data feeds like OPIS or Platts to watch crack spreads and crude differentials.
Yeah.
But, and this is key, it avoids the trap of running the math constantly, which just creates noise and panics the operators.
Right, nobody wants an alarm going off every three seconds. It waits for a meaningful shift.
Exactly. It uses two distinct triggers. The first is a process trigger. So if a key piece of equipment drifts outside its normal operating window, Reflex initiates a re-solve to figure out how to compensate.
And the second?
The second is a price trigger. If the crack spread moves materially, say, the margin jumps by two dollars or more per barrel, the economics have fundamentally changed. Running the plant the way you did an hour ago is now leaving money on the table, so Reflex runs the numbers again based on the live market.
And when it runs the numbers, it doesn't replace the planning team's Excel model, right? All those years of tuning and local knowledge stay completely intact. Reflex just acts as the lightning-fast, automated data entry clerk. It pushes the live data into their existing trusted model and just hits run.
Which leads us to the translation phase, where the modern tech stack really shines. Reflex uses Claude, a large language model, to process the raw mathematical output from the LP.
Oh, interesting.
Now, it's important to understand the mechanism here. The AI is not doing the financial math itself. Large language models are notoriously bad at math and, you know, prone to hallucination.
Yeah, we've all seen AI fail at basic addition.
Exactly. So instead, Claude simply extracts the exact delta from the Excel model's hard outputs and translates that data into a plain-English recommendation with full context.
So it turns a massive grid of numbers into a simple sentence. It will say, um, "Crack spreads widened $1.80 per barrel in the last two hours. Model recommends increasing naphtha yield by 8% on units 3 and 4."
And it gives them the exact dollar amount. It will say, "Estimated margin impact: +$44,000 at current throughput." That is so powerful. It's not just turn this dial, it's turning this dial makes us 44 grand right now.
And then it delivers that message directly to the operators via Slack or Teams. No new software to log into, no training required.
Just a message right where they already work. Here's where it gets really interesting. Are we talking about an AI autonomously turning valves and running an oil refinery? Because that sounds absolutely terrifying.
Oh, definitely not. Yeah. The creators of Reflex are very explicit about this by design. This is strictly decision support, not autonomous control. Refining is a high-consequence environment. If something goes wrong, it is incredibly dangerous.
Right, lives are on the line.
Exactly. Operators are rightfully highly skeptical of AI in these settings. You do not earn their trust by taking control away from them.
You earn trust by showing your work. Here's the data, here's the math, here is the financial impact, you make the call.
The human is always the ultimate decision-maker. But this human-in-the-loop system introduces a new friction point. What happens when the human operator fundamentally disagrees with the machine? In reality, operators push back on LP models constantly.
Wait, if the math in the model is technically perfect, why would an operator ever say no to $44,000?
Because mathematical models rarely capture the physical reality of what operators call soft constraints. Put yourself in the shoes of an operator at 2:00 AM. You are responsible for a machine operating at 800 degrees under immense pressure.
Okay, stressful.
Very. The spreadsheet model might tell you to push a specific unit to maximum capacity to capture a pricing spike. But you know that heat exchanger 201 has been rattling all week, or maybe a certain valve is sticky and doesn't have its full range of motion. You are not going to push that unit, no matter what the math says, because you are the one responsible if it blows a seal.
That makes total sense. Or what if the math is perfectly fine but the operator just knows something the computer doesn't, like a hurricane is coming to the Gulf Coast, or there's a planned maintenance shutdown in three weeks? A spreadsheet can't comprehend that, so the operator just ignores the alert.
And because there's traditionally no feedback mechanism, no one captures why the alert was ignored. The model never learns about the sticky valve or the upcoming shutdown. So the very next day, the system recommends the exact same impossible move. The operator ignores it again.
And they just stop caring.
Exactly. This inevitably leads to alert fatigue, where operators just stop reading the recommendations entirely. It becomes just another annoying alarm they tune out. But Reflex has a two-path feedback system to fix this, right? Let's look at path one, the quantifiable path. If the system says, "push unit 2", the operator can reply right in Slack, "can't push unit 2, heat exchanger 201 is fouling."
Yeah, and Reflex actually extracts that new constraint, applies it to the LP model as a new mathematical bound, and reruns the math on the spot.
It then comes back to the operator with a revised alternative. It might say, "Understood. With unit 2 capped, revised recommendation is to increase diesel on unit 6 instead. Revised margin improvement is $11,200." It gives operations a real alternative based on their feedback, rather than just hitting a dead end.
That's brilliant. Then there is path two, for the qualitative or temporary constraints. If the operator replies, "not making that move, turnaround in 3 weeks," Reflex knows it can't mathematically model a maintenance schedule, but it logs it. It documents the pushback, timestamps it, tags the operator, and routes it to the planning team. And it puts it into a constraint registry.
What's fascinating here is how this solves a decades-old problem in manufacturing. Every single operator constraint is logged into this running registry. Once it's in there, the LP won't re-recommend a move that conflicts with it until a human explicitly clears that constraint.
It just remembers.
It completely eliminates the alert fatigue because the system stops nagging them about a move they already ruled out.
So it's like a GPS that actually remembers when you tell it a specific road is permanently closed, instead of stubbornly telling you to make a U-turn every single day.
Exactly. And just like that GPS mapping the actual terrain, over time, the AI starts to surface larger patterns from this registry. It might flag to management, "Hey, this unit 2 feed cap has been invoked by operators 11 times in the last 60 days. You should probably make this a permanent seasonal constraint in the main model."
Oh, I see. It transforms subjective, invisible operator intuition into a permanent institutional knowledge base.
That feedback loop alone feels like a massive leap forward. But to justify building a whole company around this, the platform has to do more than just route Slack messages. Let's talk about the intelligence features operating under the hood, starting with something called coefficient reconciliation.
Yeah, this targets a massive silent bleed in process engineering. The yield coefficients in the LP. The math that says this specific crude oil produces exactly 8% naphtha, those numbers were set when the model was originally built. But industrial reality drifts.
What do you mean by drifts?
Well, catalysts inside the reactors degrade over time due to chemical coking. Extreme heat warps internal components. Operating conditions subtly shift. Reflex continuously tracks the LP's perfect mathematical predictions against the gritty actual outcomes in the plant.
So if the Excel model confidently expects an 8% yield, but the plant is only physically getting 4% for a month straight, Reflex spots the discrepancy. It flags that the math itself has drifted from reality and suggests a correction to the baseline formula.
Right, it's constantly keeping the map aligned with the territory. It also tackles the issue of sensor substitution. Because these plants run highly corrosive crude oil at extreme temperatures, physical sensors break or foul constantly.
And garbage data in means garbage recommendations out.
Precisely. So before Reflex even runs a solve, it sanity checks all the live historian data against historical ranges. Like, if a temperature sensor reading suddenly drops to absolute zero, or a feed rate is reading 40% above its maximum physical capacity, it catches it before the math even runs. And if an operator knows a sensor is broken, they can tell Reflex to just substitute it with an upstream temperature reading instead.
And Reflex logs every one of those substitutions, which eventually becomes a highly targeted maintenance prioritization tool. Management literally gets a list of which broken sensors are impacting their profitability the most, so they know exactly what to fix during the next shutdown.
And speaking of measuring profitability, we have to talk about the opportunity cost tracking dashboard. When an operator overrides a recommendation, and the plant ends up running sub-optimally compared to what the LP predicted, Reflex tallies the real-world financial cost of that ignored recommendation.
That's a huge feature. It's a rolling 30 or 90-day dashboard showing exactly how much money is bleeding out through the friction between the theoretical model and the physical operations. And it isn't about pointing fingers at the operators, right? It's about showing management which physical bottlenecks, like that rattling heat exchanger, are actually worth spending capital to replace.
This raises an important question about defensibility and the business model itself. How does a startup protect a workflow tool like this from being copied? The natural instinct in software is to patent everything. But when you look at their business strategy, they are actually incredibly realistic about their intellectual property. Patents are not the primary moat here.
Right, because you might be able to patent the specific human-clearance mechanism of the constraint registry, but you can't really patent the broad concept of AI interpreting math results, or connecting a database to a model. There's just too much prior art going back decades.
Exactly. The true protection here is speed, customer relationships, and integration depth. Once this software is installed, it is building a site-specific constraint knowledge base and a deep history of coefficient reconciliations. That data is gold.
It is incredibly valuable, and it doesn't transfer if the customer decides to rip the software out and switch to a competitor. Plus, becoming deeply integrated into their process historian, their highly customized Excel models, and their daily operator communication channels makes the software incredibly sticky.
So the actual software isn't even the most valuable part of the company. It's the site-level data and being the first to get inside the door. In the mid-market refining industry, a reference customer, a real plant that proves your tool safely increases margin, is worth far more than a patent. The go-to-market strategy revolves around moving fast, finding those first design partner refineries, and building the tools seamlessly around their actual daily workflows.
And the business potential here is huge. Reflex is targeting a price point of 75,000 to 125,000 dollars per site per year. That is a fraction of the enterprise RTO cost, making it an incredibly easy decision for a mid-market plant manager.
No, a total no-brainer.
Right, with just 80 to 120 target sites in North America alone, they are looking at a realistic 8 to 15 million in annual recurring revenue. And the realistic exit strategy isn't an IPO, it's a 100 to 250 million dollar acquisition by one of the industrial giants like AspenTech or Seeq, who would much rather buy this proven mid-market channel than try to build a lightweight version of their own heavy software.
It is a highly rational business case. But, you know, it all hinges on solving that very human, very manual bottleneck at the center of the operation.
So, what does this all mean? When you step back and look at the whole picture, the magic of Reflex isn't that they invented a new way to optimize crude oil. The math has existed for decades. The live sensor data is already being collected by the historian. The optimization model is already built and sitting on an engineer's desk.
They didn't reinvent the wheel.
Exactly. The brilliant innovation is just building the wire. Connecting those three existing pillars in real-time, and using AI to translate the dense mathematical output into plain English for an operator who has exactly 30 seconds to make a critical decision.
It truly is a masterclass in identifying unsexy, highly valuable business-to-business problems. We often think of innovation as flying cars or autonomous robots. But sometimes, the most lucrative innovation looks like fixing a broken workflow that relies on a human typing numbers into Microsoft Excel.
It's just wild to think about that level of global scale relying on a manual update. And for you listening, it's a great reminder to look for these unseen bottlenecks in your own industries. It really leaves us with a broader question to consider.
If a massive, multi-million dollar operational gap like this exists in heavy industry simply because a sophisticated spreadsheet is disconnected from live data, what other critical legacy industries are relying on static, disconnected models right now? Where else are we navigating with a map we only update once a day, just waiting for someone to build the wire that connects them to reality?
