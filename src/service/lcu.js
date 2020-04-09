import http from './http';
import { getLcuToken } from 'src/share/file';

export default class LCUService {
  constructor(lolDir) {
    this.lolDir = lolDir;
  }

  setVars = (token, port, url) => {
    this.url = url;
    this.token = token;
    this.port = port;
    this.urls = {
      authToken: `${url}/riotclient/auth-token`,
      curSession: `${url}/lol-champ-select/v1/session`,
      curPerk: `${url}/lol-perks/v1/currentpage`,
      perks: `${url}/lol-perks/v1/pages`,
    };
    this.auth = {
      auth: {
        username: `riot`,
        password: token,
      },
    };
  };

  getAuthToken = async () => {
    const [token, port, url] = await getLcuToken(this.lolDir);
    this.setVars(token, port, url);
  };

  getLcuStatus = async () => {
    const { urls, auth } = this;

    try {
      const res = await http.get(urls.authToken, auth);
      if (res) {
        return true;
      }
    } finally {
      return false;
    }
  };

  getCurrentSession = async () => {
    const res = await http.get(this.urls.curSession, this.auth);
    console.log(res);
  };

  getCurPerk = async () => {
    const res = await http.get(this.urls.curPerk, this.auth);
    console.log(res);
  };

  getPerkList = async () => {
    const res = await http.get(this.urls.perks, this.auth);
    console.log(res);
  };
}
