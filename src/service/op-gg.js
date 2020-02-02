import { requestHtml } from './utils';

const OpggUrl = `https://www.op.gg`;

export const getPositions = async () => {
	const $ = await requestHtml(`${ OpggUrl }/champion/statistics`);

	const items = $(`.champion-index__champion-list`)
		.find(`.champion-index__champion-item`);
	const result = items
		.toArray()
		.map(itm => {
			const champ = $(itm);
			const { championKey, championName } = champ.data();
			const positions = champ.find(`.champion-index__champion-item__position`)
				.toArray()
				.map(i => $(i).text().toLowerCase());
			// todo: champion avatar
			// const avatar = champ.find(`.champion-index__champion-item__image`)

			return {
				key: championKey,
				name: championName,
				positions: positions.slice(),
			};
		});

	return result;
};

export const getSpellName = (imgSrc = '') => {
	const matched = imgSrc.match(/(.*)\/Summoner(.*)\.png/) || [''];
	return matched.pop();
};

export const getItems = async (championName, position, version) => {
	if (!championName || !position)
		return Promise.reject(`Please specify champion & position.`);

	const $ = await requestHtml(`${ OpggUrl }/champion/${ championName }/statistics/${ position }`);
	const spellTables = $(`.champion-overview__table.champion-overview__table--summonerspell tbody`);

	const spells = spellTables.eq(0).find(`tr`)
		.toArray()
		.map(item => {
			const imgs = $(item).find(`.champion-stats__list__item img`);
			const src = imgs.map((idx, i) => $(i).attr(`src`));
			return src.toArray();
		});
	const skills = spellTables.eq(1)
		.find(`.champion-stats__list`)
		.find(`.champion-stats__list__item`).text().trim().replace(/\s+/g, '>');
	const spellNames = spells.map(arr => arr.map(getSpellName));

	const blocks = $(`.champion-overview__table`).eq(1).find(`tbody > tr`)
		.toArray()
		.reduce((groups, row) => {
			const len = groups.length;
			let cur = groups[len - 1];

			if ($(row).attr(`class`).includes(`--first`)) {
				const type = $(row).find(`th.champion-overview__sub-header`).text();
				cur = {
					type,
					items: [],
				};
				groups[len] = cur;
			}

			const items = $(row).find(`td.champion-overview__data .champion-stats__list .champion-stats__list__item img`)
				.map((_, i) => {
					const id = $(i).attr(`src`).match(/(.*)\/(.*)\.png/).pop();

					return {
						id,
						count: 1,
					};
				});

			cur.items = cur.items.concat(items.toArray());
			return groups;
		}, []);

	return {
		key: championName,
		champion: championName,
		position,
		spellNames,
		skills,
		'sortrank': 1,
		priority: false,
		map: `any`,
		mode: `any`,
		type: `custom`,
		title: `[op.gg] ${ championName } - ${ position } - ${ version }`,
		blocks,
	};
};

