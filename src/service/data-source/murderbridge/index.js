import _noop from 'lodash/noop';
import { nanoid as uuid } from 'nanoid';
import { CancelToken } from 'axios';

import http from 'src/service/http';
import SourceProto from 'src/service/data-source/source-proto';
import * as Ddragon from 'src/service/ddragon';
import Sources from 'src/share/constants/sources';
import { makeBuildFile, saveToFile } from 'src/share/file';
import { addFetched, addFetching, fetchSourceDone } from 'src/share/actions';

import {
  generalSettings,
  generateOptimalPerks,
  isBoot,
  runeLookUpGenerator,
  scoreGenerator,
} from './utils';

const ApiPrefix = `https://d23wati96d2ixg.cloudfront.net`;
const CDN_URL = `https://cdn.jsdelivr.net/npm/@champ-r/murderbridge`;
const T_NPM_URL = `https://registry.npm.taobao.org/@champ-r/murderbridge`;

const sortByScore = (a, b) =>
  scoreGenerator(b[1].winRate, b[1].frequency, 2.5, generalSettings) -
  scoreGenerator(a[1].winRate, a[1].frequency, 2.5, generalSettings);

const getItems = (items, limit = 3) => {
  const sorted = Object.entries(items).sort((a, b) => sortByScore(a, b));
  const itemSet = sorted
    .slice(0, limit)
    .map((i) => [].concat(JSON.parse(i[0])))
    .reduce((ids, cur) => {
      cur.forEach((i) => {
        const [target] = [].concat(i);
        ids.add(target);
      });
      return ids;
    }, new Set());
  const result = Array.from(itemSet).map((i) => ({
    id: `${i}`,
    count: 1,
  }));

  return result;
};

export default class MurderBridge extends SourceProto {
  constructor(lolDir, itemMap, dispatch = _noop) {
    super();
    this.lolDir = lolDir;
    this.itemMap = itemMap;
    this.dispatch = dispatch;
    this.version = null;
  }

  static getLolVersion = async () => {
    try {
      const { upToDateVersion } = await http.get(`${ApiPrefix}/save/general.json`);
      // this.version = upToDateVersion;
      return upToDateVersion;
    } catch (err) {
      throw new Error(err);
    }
  };

  static getPkgInfo = () => SourceProto.getPkgInfo(T_NPM_URL, CDN_URL);

  getRunesReforged = async (version) => {
    try {
      const data = await Ddragon.getRunesReforged(version);
      return data;
    } catch (err) {
      throw new Error(err);
    }
  };

  getChampionPerks = async (champion) => {
    try {
      const version = await MurderBridge.getLolVersion();
      this.version = version;
      const [{ runes }, reforgedRunes] = await Promise.all([
        this.getChampData(champion, version),
        this.getRunesReforged(version),
      ]);
      const runesLookUp = runeLookUpGenerator(reforgedRunes);
      const perks = generateOptimalPerks(null, null, runes, runesLookUp);
      return perks.map((i) => ({
        ...i,
        alias: champion,
        name: `${[Sources.MurderBridge]} ${champion}`,
      }));
    } catch (err) {
      throw new Error(err);
    }
  };

  makeItemBuilds = ({ starting, build }, { id: alias, key: championId }) => {
    const startItems = getItems(starting, 3);
    const startBlocks = {
      type: `Starters`,
      showIfSummonerSpell: '',
      hideIfSummonerSpell: '',
      items: startItems,
    };

    const buildItems = getItems(build, 13);
    const itemsWithoutBoots = buildItems.filter((i) => !isBoot(i.id, this.itemMap));
    const boots = buildItems.filter((i) => isBoot(i.id, this.itemMap));

    const bootBlocks = boots.length > 0 && {
      type: `Boots`,
      showIfSummonerSpell: '',
      hideIfSummonerSpell: '',
      items: boots,
    };
    const buildBlocks = {
      type: `Core Items`,
      showIfSummonerSpell: '',
      hideIfSummonerSpell: '',
      items: itemsWithoutBoots,
    };

    const item = makeBuildFile(
      {
        fileName: `[ARAM] [${Sources.MurderBridge.toUpperCase()}] ${alias}`,
        title: `[${Sources.MurderBridge.toUpperCase()}] ${alias}`,
        championId: +championId,
        champion: alias,
        blocks: [startBlocks, bootBlocks, buildBlocks],
      },
      true,
    );

    return item;
  };

  getChampData = async (champion, version) => {
    try {
      const $identity = uuid();
      this.dispatch(
        addFetching({
          $identity,
          champion,
          source: Sources.MurderBridge,
        }),
      );

      const res = await http.get(`${ApiPrefix}/save/${version}/ARAM/${champion}.json`, {
        cancelToken: new CancelToken((c) => {
          this.setCancelHook(`mr-${champion}`)(c);
        }),
      });

      this.dispatch(
        addFetched({
          $identity,
        }),
      );
      return res;
    } catch (err) {
      throw new Error(err);
    }
  };

  import = async () => {
    try {
      const version = await MurderBridge.getLolVersion();
      this.version = version;
      const championList = await Ddragon.getChampions(version);
      const tasks = Object.values(championList).map((champion) =>
        this.getChampData(champion.id, version).then((data) => {
          const { items } = data;
          const item = this.makeItemBuilds(items, champion);
          return saveToFile(this.lolDir, item);
        }),
      );
      const result = await Promise.all(tasks);
      this.dispatch(fetchSourceDone(Sources.MurderBridge));
      return result;
    } catch (err) {
      throw new Error(err);
    }
  };

  getChampionDataFromCDN = async (champion, version, $id) => {
    try {
      const data = await http.get(`${CDN_URL}@${version}/${champion}.json`, {
        cancelToken: new CancelToken(this.setCancelHook($id)),
      });
      return data;
    } catch (err) {
      console.error(err);
      throw new Error(err);
    }
  };

  genBuildsFromCDN = async (champion, version, lolDir) => {
    try {
      const $identity = uuid();
      this.dispatch(
        addFetching({
          champion,
          $identity,
          source: Sources.MurderBridge,
        }),
      );

      const data = await this.getChampionDataFromCDN(champion, version, $identity);
      const tasks = data.reduce((t, i) => {
        const { position, itemBuilds } = i;
        itemBuilds.forEach((k) => {
          const file = {
            ...k,
            champion,
            position,
            fileName: `[${Sources.MurderBridge.toUpperCase()}] ${champion}`,
          };
          t = t.concat(saveToFile(lolDir, file));
        });

        return t;
      }, []);

      const r = await Promise.allSettled(tasks);
      this.dispatch(
        addFetched({
          champion,
          $identity,
          source: Sources.MurderBridge,
        }),
      );
      return r;
    } catch (err) {
      console.error(err);
      throw new Error(err);
    }
  };

  importFromCDN = async () => {
    try {
      const { version, sourceVersion } = await MurderBridge.getPkgInfo();
      const championList = await Ddragon.getChampions(sourceVersion);

      const tasks = Object.values(championList).map((champion) =>
        this.genBuildsFromCDN(champion.id, version, this.lolDir),
      );
      const r = await Promise.allSettled(tasks);
      const result = r.reduce(
        (arr, cur) =>
          arr.concat(
            cur.status === `rejected`
              ? {
                  status: `rejected`,
                  value: cur.reason,
                  reason: cur.reason,
                }
              : cur.value,
          ),
        [],
      );
      console.info(result);
    } catch (err) {
      throw new Error(err);
    }
  };
}
