import { requestHtml } from 'src/service/utils';

import { saveToFile } from 'src/share/file';
import { Actions } from 'src/share/actions';

const OpggUrl = `https://www.op.gg`;

export const getStat = async () => {
	const $ = await requestHtml(`${OpggUrl}/champion/statistics`);

	const items = $(`.champion-index__champion-list`).find(`.champion-index__champion-item`);
	const result = items
		.toArray()
		.map(itm => {
			const champ = $(itm);
			const { championKey, championName } = champ.data();
			const positions = champ
				.find(`.champion-index__champion-item__position`)
				.toArray()
				.map(i => $(i).text().toLowerCase());

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

export const genChampionData = async (championName, position, version) => {
	if (!championName || !position)
		return Promise.reject(`Please specify champion & position.`);

	try {
		const [items, skills] = await Promise.all([
			genBlocks(championName, position),
			genSkills(championName, position),
		]);

		return {
			'sortrank': 1,
			priority: false,
			map: `any`,
			mode: `any`,
			type: `custom`,
			key: championName,
			champion: championName,
			position,
			title: `[OP.GG] ${position} - ${version}`,
			fileName: `[OP.GG]${championName}-${position}-${version}`,
			skills,
			// TODO
			blocks: [{
				type: `op.gg`,
				items: items,
			}],
		};
	} catch (err) {
		return err;
	}
};

// TODO: sort
export const genBlocks = async (champion, position) => {
	try {
		const $ = await requestHtml(`${OpggUrl}/champion/${champion}/statistics/${position}/item`);

		const itemTable = $(`.l-champion-statistics-content__side .champion-stats__table`)[0];
		const blocks = $(itemTable)
			.find(`tbody tr`)
			.toArray()
			.map(tr => {
				const [itemTd, pRateTd, wRateTd] = $(tr).find(`td`).toArray();
				const itemId = $(itemTd).find(`img`).attr(`src`).match(/(.*)\/(.*)\.png/).pop();
				const pRate = $(pRateTd).find(`em`).text().replace(',', '');
				const wRate = $(wRateTd).text().replace(`%`, '');

				return {
					id: itemId,
					count: 1,
					pRate,
					wRate,
				};
			});

		return blocks;
	} catch (err) {
		return err;
	}
};

export const genSkills = async (champion, position) => {
	try {
		const $ = await requestHtml(`${OpggUrl}/champion/${champion}/statistics/${position}/skill`);

		const skills = $(`.champion-stats__filter__item .champion-stats__list`)
			.toArray()
			.map(i =>
				$(i).find(`.champion-stats__list__item`)
					.toArray()
					.map(j => $(j).text().trim()),
			);

		return skills;
	} catch (err) {
		return err;
	}
};

export default async function importItems(version, lolDir, dispatch) {
	const res = await getStat();
	const tasks = res
		// TODO: remove
		.slice(0, 10)
		.reduce((t, item) => {
			const { positions, key: champion } = item;
			const positionTasks = positions.map(position => {
				dispatch({
					type: Actions.ADD_FETCHING,
					payload: `${champion}-${position}`,
				});

				// TODO: save after got data
				return genChampionData(champion, position, version)
					.then(data => {
						dispatch({
							type: Actions.ADD_FETCHED,
							payload: data,
						});

						console.log(data);
						return data;
					});
			});

			return t.concat(positionTasks);
		}, []);

	const fetched = await Promise.all(tasks);

	if (!lolDir) {
		// TODO: notification
		return;
	}

	const t = fetched.map(i => saveToFile(lolDir, i));

	try {
		const result = await Promise.all(t);
		return result;
	} catch (err) {
		return err;
	}
}
