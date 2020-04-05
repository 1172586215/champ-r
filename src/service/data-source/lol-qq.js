import { nanoid as uuid } from 'nanoid';
import _get from 'lodash/get';
import _find from 'lodash/find';
import { CancelToken } from 'axios';

import http from 'src/service/http';
import { saveToFile } from 'src/share/file';
import { genFileBlocks } from 'src/service/utils';
import { addFetched, addFetching, fetchSourceDone } from 'src/share/actions';
import Sources from 'src/share/sources';

import SourceProto from './source-proto';
// Import { Actions } from 'src/share/actions';

const API = {
  List: 'https://game.gtimg.cn/images/lol/act/img/js/heroList/hero_list.js',
  Positions: 'https://lol.qq.com/act/lbp/common/guides/guideschampion_position.js',
  detail: id => `https://lol.qq.com/act/lbp/common/guides/champDetail/champDetail_${id}.js`,
  Items: 'https://ossweb-img.qq.com/images/lol/act/img/js/items/items.js',
};

export const parseCode = string => {
  try {
    const [result] = string.match(/{"(.*)"}/);
    const data = JSON.parse(result);
    return data;
  } catch (error) {
    throw new Error(error);
  }
};

export const getItemList = async () => {
  try {
    const { items: itemList } = await http.get(API.Items);
    return itemList;
  } catch (error) {
    throw new Error(error);
  }
};

export default class LolQQ extends SourceProto {
  constructor(lolDir, itemMap, dispatch) {
    super();
    this.lolDir = lolDir;
    this.itemMap = itemMap;
    this.dispatch = dispatch;
  }

  getChampionList = async () => {
    try {
      const data = await http.get(API.List, {
        cancelToken: new CancelToken(c => {
          this.setCancelHook(`qq-stats`)(c)
        }),
      });
      return data;
    } catch (error) {
      throw new Error(error);
    }
  };

  getChampionPositions = async () => {
    try {
      const code = await http.get(API.Positions, {
        cancelToken: new CancelToken(c => {
          this.setCancelHook(`qq-positions`)(c)
        }),
      });
      const { list } = parseCode(code);
      return list;
    } catch (error) {
      throw new Error(error);
    }
  };

  getChampionDetail = (champions, dispatch) => async id => {
    try {
      const { alias } = _find(champions, { heroId: id });
      const $identity = uuid();

      dispatch(addFetching({
        $identity,
        champion: alias.toLowerCase(),
        source: Sources.Lolqq,
      }));

      const apiUrl = API.detail(id);
      const code = await http.get(apiUrl, {
        cancelToken: new CancelToken(c => {
          this.setCancelHook($identity)(c)
        }),
      });

      dispatch(addFetched({
        $identity,
      }));

      const data = parseCode(code);
      return data.list;
    } catch (error) {
      throw new Error(error);
    }
  };

  makeItem = ({ data, positions, champion, version, itemMap }) => {
    const { alias } = champion;
    const { championLane } = data;

    const result = positions.reduce((res, position) => {
      const laneItemsString = _get(championLane, `${position}.hold3`, []);
      const rawBlocks = JSON.parse(laneItemsString);
      const rawItems = rawBlocks.map(i => ({
        id: i.itemid,
        count: 1,
        pRate: i.showrate,
        wRate: i.winrate,
      }));
      
      const blocks = genFileBlocks(rawItems, itemMap, position);

      const item = {
        sortrank: 1,
        priority: false,
        map: 'any',
        mode: 'any',
        type: 'custom',
        key: alias.toLowerCase(),
        champion: alias,
        position,
        title: `[LOL.QQ.COM] ${position} - ${version}`,
        fileName: `[LOL.QQ.COM]${alias}-${position}-${version}`,
        skills: [],
        blocks,
      };

      return res.concat(item);
    }, []);

    return result;
  };

  import = async () => {
    const {
      lolDir,
      itemMap,
      dispatch,
    } = this;

    try {
      const [
        {
          version,
          hero: championList,
        },
        positionMap,
      ] = await Promise.all([
        this.getChampionList(),
        this.getChampionPositions(),
      ]);

      const championIds = Object.keys(positionMap);
      const tasks = championIds.map(this.getChampionDetail(championList, dispatch));
      const detailList = await Promise.all(tasks);

      const items = detailList.reduce((res, item, idx) => {
        const id = championIds[idx];
        const positions = Object.keys(positionMap[id]);
        const champion = _find(championList, { heroId: id });

        const block = this.makeItem({
          data: item,
          positions,
          champion,
          version,
          itemMap,
        });
        return res.concat(block);
      }, []);

      const fileTasks = items.map(i => saveToFile(lolDir, i));
      const result = await Promise.all(fileTasks);

      dispatch(fetchSourceDone(Sources.Lolqq));

      return result;
    } catch (error) {
      throw new Error(error);
    }
  };
}
