import Grid from './Grid.js';
import FoodBot from './FoodBot.js';

let canvas, ctx, lastDraw, lastTick, drawId, tickId, grid, population, genCount, foodEaten, MAX_FIT;
const TPS = 60;
const FOOD_PER_BOT = 10;
const POP_SIZE = 50;
const MUTATE_RATE = 0.001;

window.addEventListener('load', init);

function init() {
	canvas = document.querySelector('canvas');
	canvas.width = 1024;
	canvas.height = 768;
	ctx = canvas.getContext('2d');

	// set up download button
	document.getElementById('download').addEventListener('click', () => {
		const commands = [];
		document.getElementById('food-bot')
			.querySelectorAll('[data-code]')
			.forEach((span) => {
				commands.push(span.textContent.trim());
			});

		const aTag = document.createElement('a');
		aTag.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(commands));
		aTag.download = 'foodbot.json';
		aTag.style.display = 'none';
		document.body.append(aTag);
		aTag.click();
		aTag.remove();
	});

	//initiate values
	genCount = 0;
	foodEaten = 0;

	// initiate grid
	grid = new Grid(100, 75);
	grid.fill(false);
	let n = FOOD_PER_BOT * POP_SIZE;
	while(n > 0) {
		const x = Math.floor(grid.width * Math.random());
		const y = Math.floor(grid.height * Math.random());
		if(!grid.get(x, y)) {
			grid.set(x, y, true);
			n--;
		}
	}

	MAX_FIT = FOOD_PER_BOT * POP_SIZE / (grid.width * grid.height) * FoodBot.LIFETIME;

	// initiate population
	population = [];
	for(let i = 0; i < POP_SIZE; i++) {
		const bot = new FoodBot(grid);
		bot.init();
		population.push(bot);
	}

	// begin evolution
	lastDraw = Date.now();
	drawId = requestAnimationFrame(draw);
	lastTick = Date.now();
	tickId = setTimeout(tick, 1000 / TPS);
}

function draw() {
	const currentDraw = Date.now();
	const dt = (currentDraw - lastDraw) / 1000;

	ctx.clearRect(0, 0, canvas.width, canvas.height);

	// draw the grid
	drawGrid(grid, ctx);

	// draw the food
	ctx.fillStyle = '#007fff';
	for(let x = 0; x < grid.width; x++) {
		for(let y = 0; y < grid.height; y++) {
			if(!grid.get(x, y)) continue;

			// found a food item
			const foodX = (x + 0.5) * canvas.width / grid.width;
			const foodY = (y + 0.5) * canvas.height / grid.height;
			const foodW = 0.4 * canvas.width / grid.width;
			const foodH = 0.4 * canvas.height / grid.height;
			const foodR = Math.min(foodW, foodH) / 2;

			ctx.beginPath();
			ctx.arc(foodX, foodY, foodR, 0, 2 * Math.PI);
			ctx.fill();
		}
	}

	// find best performing bot
	let bestBot = null;
	for(let i = 0; i < POP_SIZE; i++) {
		const bot = population[i];
		if(!bestBot || bot.getFitness() > bestBot.getFitness()) {
			bestBot = bot;
		}
	}

	// draw the food bots
	ctx.lineWidth = 2;
	for(let i = 0; i < POP_SIZE; i++) {
		const bot = population[i];
		const color = bot == bestBot ? '#00bf00' : '#3f3f3f';
		bot.draw(ctx, color);
	}

	lastDraw = currentDraw;
	drawId = requestAnimationFrame(draw);
}

function drawGrid(grid, ctx) {
	ctx.strokeStyle = '#bfbfbf';
	ctx.lineWidth = 1;
	ctx.beginPath();

	// horizontal lines
	for(let x = 0; x < grid.width; x++) {
		ctx.moveTo(x / grid.width * canvas.width, 0);
		ctx.lineTo(x / grid.width * canvas.width, canvas.height);
	}

	// vertical lines
	for(let y = 0; y < grid.width; y++) {
		ctx.moveTo(0 , y / grid.height * canvas.height);
		ctx.lineTo(canvas.width, y / grid.height * canvas.height);
	}
	ctx.stroke();
}

function tick() {
	const currentTick = Date.now();
	const dt = (currentTick - lastTick) / 1000;

	// live life
	let genRunning = false;
	foodEaten = 0;
	for(let i = 0; i < POP_SIZE; i++) {
		const bot = population[i];
		// let all bots run as long as they can in the timeframe given
		if(!bot.isDead()) {
			bot.run();
			genRunning = true;
		}
		foodEaten += bot.food;
	}

	const percentEaten = foodEaten / (FOOD_PER_BOT * POP_SIZE);
	document.getElementById('eaten').textContent = toPercent(percentEaten);

	// generation over
	if(!genRunning) generate();

	lastTick = currentTick;
	tickId = setTimeout(tick, 1000 / TPS);
}

function generate() {
	const mateChances = [];
	let bestFit = 0;
	let bestFitBot = null;
	genCount++;

	// calculate best food bot
	for(let i = 0; i < POP_SIZE; i++) {
		const bot = population[i];
		const botFit = bot.getFitness() / MAX_FIT;
		if(!bestFitBot || botFit > bestFit) {
			bestFit = botFit;
			bestFitBot = bot;
		}
		mateChances.push(botFit);
	}

	// update stats
	document.getElementById('food-bot').innerHTML = bestFitBot.toHTML();
	document.getElementById('fitness').textContent = toPercent(bestFit);
	document.getElementById('generation').textContent = genCount;
	foodEaten = 0;

	// create next generation of food bots
	const nextGen = [];
	for(let i = 0; i < POP_SIZE; i++) {
		const parent1 = population[simulate(mateChances)];
		const parent2 = population[simulate(mateChances)];
		const child = parent1.crossover(parent2);
		child.mutate(MUTATE_RATE);
		nextGen.push(child);
	}

	// reset grid
	grid.fill(false);
	let n = FOOD_PER_BOT * POP_SIZE;
	while(n > 0) {
		const x = Math.floor(grid.width * Math.random());
		const y = Math.floor(grid.height * Math.random());
		if(!grid.get(x, y)) {
			grid.set(x, y, true);
			n--;
		}
	}

	population = nextGen;
}

// accepts an array of positive values indicating likelihood
// returns an index probabilistically chosen
function simulate(chances) {
	let sum = 0;
	for(let i = 0; i < chances.length; i++) {
		sum += chances[i];
	}
	if(sum == 0) {
		return Math.floor(Math.random() * chances.length);
	}
	const rand = Math.random();
	let chance = 0;
	for(let i = 0; i < chances.length; i++) {
		chance += chances[i] / sum;
		if(rand < chance) return i;
	}
	return -1;
}

function toPercent(x) {
	return Math.floor(100 * x) + '%';
}
