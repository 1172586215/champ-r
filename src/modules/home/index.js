/* eslint react-hooks/exhaustive-deps: 0 */
import s from 'src/app.module.scss';

import { ipcRenderer, remote } from 'electron';

import React, { useContext, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import cn from 'classnames';

import { CornerDownRight } from 'react-feather';
import { useStyletron } from 'baseui';
import { Button } from 'baseui/button';
import { Checkbox, STYLE_TYPE, LABEL_PLACEMENT } from 'baseui/checkbox';
import { StatefulTooltip as Tooltip } from 'baseui/tooltip';
import { Notification, KIND } from 'baseui/notification';
import { Tag, VARIANT } from 'baseui/tag';
import { ArrowRight } from 'baseui/icon';
import { H6 } from 'baseui/typography';

import config from 'src/native/config';
import { updateConfig, updateDataSourceVersion } from 'src/share/actions';
import { ChampionKeys } from 'src/share/constants/champions';

import Sources, { isAram } from 'src/share/constants/sources';
import AppContext from 'src/share/context';
import { useTranslation } from 'react-i18next';
import OpGG from 'src/service/data-source/op-gg';
import LolQQ from 'src/service/data-source/lol-qq';
import MurderBridge from 'src/service/data-source/murderbridge';

export default function Home() {
  const [css, theme] = useStyletron();
  const { store, dispatch } = useContext(AppContext);
  const history = useHistory();
  const { t } = useTranslation();

  const [selectedSources, toggleSource] = useState(config.get(`selectedSources`));
  const [lolDir, setLolDir] = useState(config.get('lolDir'));

  const toggleKeepOldItems = (ev) => {
    const { checked } = ev.target;
    dispatch(updateConfig('keepOld', checked));
  };

  const onSelectDir = async () => {
    const { canceled, filePaths } = await remote.dialog.showOpenDialog({
      properties: ['openDirectory'],
    });
    if (canceled) {
      return;
    }

    const dir = filePaths[0];
    setLolDir(dir);
  };

  const clearFolder = () => {
    setLolDir('');
  };

  const onCheck = (value) => (ev) => {
    const { checked } = ev.target;
    let res;
    if (checked) {
      res = selectedSources.concat(value);
    } else {
      const idx = selectedSources.indexOf(value);
      res = [...selectedSources.slice(0, idx), ...selectedSources.slice(idx + 1)];
    }

    toggleSource(res);
    dispatch(updateConfig(`selectedSources`, res));
  };

  const startImport = () => {
    history.push(`/import`);
  };

  useEffect(() => {
    OpGG.getPkgInfo().then(({ sourceVersion }) => {
      dispatch(updateDataSourceVersion(Sources.Opgg, sourceVersion));
    });
    LolQQ.getLolVersion().then((v) => {
      dispatch(updateDataSourceVersion(Sources.Lolqq, v));
    });
    MurderBridge.getLolVersion().then((v) => {
      dispatch(updateDataSourceVersion(Sources.MurderBridge, v));
    });
  }, []);

  useEffect(() => {
    // persist user preference
    config.set('keepOldItems', store.keepOld);
    config.set('lolDir', lolDir);
    config.set(`selectedSources`, selectedSources);
  }, [store.keepOld, lolDir, selectedSources]);

  const shouldDisableImport = !store.version || !lolDir || !selectedSources.length;

  return (
    <div className={s.container}>
      <h1 className={s.title}>
        <span>ChampR</span>
      </h1>

      <div className={s.info}>
        {t(`lol folder is`)}
        <Tag
          closeable={Boolean(lolDir)}
          kind='accent'
          onClick={onSelectDir}
          onActionClick={clearFolder}
          overrides={{
            Root: {
              style: () => ({
                minWidth: 0,
                maxWidth: `calc(100vw - 14em)`,
                paddingTop: `4px`,
              }),
            },
            Text: {
              style: ({ $theme }) => ({
                fontSize: $theme.sizing.scale550,
                flexGrow: 1,
                maxWidth: `unset`,
                alignSelf: `flex-start`,
              }),
            },
          }}>
          <Tooltip content={lolDir && t(`click here to re-select`)}>
            {lolDir || t('click here to select')}
          </Tooltip>
        </Tag>
      </div>
      <code
        className={cn(
          s.folderTip,
          css({
            backgroundColor: theme.colors.backgroundLightWarning,
            borderRadius: theme.borders.radius300,
          }),
        )}>
        <CornerDownRight size={`1.6em`} color={`#43BF75`} />
        <div dangerouslySetInnerHTML={{ __html: t('installation path of League of Legends') }} />
      </code>

      <div className={s.sources}>
        <H6 margin={`0 0 1ex 0`} color={theme.colors.borderInverseOpaque}>
          {t(`data sources`)}:
        </H6>

        {Object.values(Sources).map((v) => {
          const aram = isAram(v);
          const sourceVer = store.dataSourceVersions[v];

          return (
            <Checkbox
              key={v}
              checked={selectedSources.includes(v)}
              onChange={onCheck(v)}
              overrides={{
                Root: {
                  style: ({ $theme }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    height: '3em',
                    boxShadow: `0px 1px 0 ${$theme.colors.borderTransparent}`,
                  }),
                },
                Checkmark: {
                  style: ({ $checked, $theme }) => ({
                    borderColor: $checked
                      ? $theme.colors.positive
                      : $theme.colors.backgroundNegative,
                    backgroundColor: $checked
                      ? $theme.colors.positive
                      : $theme.colors.backgroundAlwaysLight,
                  }),
                },
                Label: {
                  style: ({ $theme }) => ({
                    fontSize: $theme.sizing.scale600,
                    textTransform: `uppercase`,
                    display: `flex`,
                    alignItems: `center`,
                  }),
                },
              }}>
              {v}
              {sourceVer && (
                <Tag closeable={false} variant={VARIANT.outlined} kind='warning'>
                  {sourceVer}
                </Tag>
              )}
              {aram && (
                <Tag closeable={false} variant={VARIANT.light} kind='positive'>
                  {t(`aram`)}
                </Tag>
              )}
            </Checkbox>
          );
        })}
      </div>

      {!lolDir && (
        <Notification
          kind={KIND.negative}
          overrides={{
            Body: {
              style: () => ({
                marginTop: `4ex`,
                width: `auto`,
              }),
            },
          }}>
          {() => t(`please specify lol dir`)}
        </Notification>
      )}

      <div className={s.control}>
        <Button
          overrides={{
            BaseButton: {
              style: ({ $theme, $disabled }) => {
                return {
                  ':hover': {
                    backgroundColor: $disabled
                      ? $theme.colors.backgroundLightAccent
                      : $theme.colors.accent,
                  },
                  backgroundColor: $disabled
                    ? $theme.colors.borderAccentLight
                    : $theme.colors.accent500,
                };
              },
            },
          }}
          disabled={shouldDisableImport}
          startEnhancer={() => <ArrowRight size={24} />}
          onClick={startImport}>
          {t(`import now`)}
        </Button>

        <Checkbox
          className={s.keepOld}
          labelPlacement={LABEL_PLACEMENT.right}
          checkmarkType={STYLE_TYPE.toggle_round}
          checked={store.keepOld}
          onChange={toggleKeepOldItems}
          overrides={{
            Root: {
              style: () => ({
                // ...$theme.borders.border100,
                display: 'flex',
                alignSelf: 'flex-end',
                marginLeft: '2ex',
                marginBottom: '0.8ex',
              }),
            },
            Checkmark: {
              style: ({ $checked, $theme }) => ({
                backgroundColor: $checked ? $theme.colors.positive : '#ffffff',
              }),
            },
            ToggleTrack: {
              style: ({ $theme }) => {
                return {
                  backgroundColor: $theme.colors.backgroundLightAccent,
                };
              },
            },
            Toggle: {
              style: ({ $theme, $checked }) => {
                return {
                  // Outline: `${$theme.colors.warning200} solid`,
                  backgroundColor: $checked
                    ? $theme.colors.borderPositive
                    : $theme.colors.backgroundLightAccent,
                };
              },
            },
          }}>
          {t('keep old items')}
        </Checkbox>
      </div>

      {(process.env.IS_DEV || process.env.SHOW_POPUP_TRIGGER) && (
        <button
          style={{ width: `6em` }}
          onClick={() => {
            ipcRenderer.send(`show-popup`, {
              championId: ChampionKeys[Math.floor(Math.random() * ChampionKeys.length)],
              position: null,
            });
          }}>
          apply
        </button>
      )}
    </div>
  );
}
