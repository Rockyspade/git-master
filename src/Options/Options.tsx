import React from 'react';
import { browser } from 'webextension-polyfill-ts';
import Switch from 'rc-switch';
import { Modal, Row, Col } from 'antd';

import optionsStorage from '@/Background/options-storage';
import localStore from '@/Background/lib/local-store';
import { requestPermission } from '@/Background/lib/permissions-service';
import Message from './Message';
import Section from './Section';
import SectionOption from './SectionOption';

import './styles.less';
import 'rc-switch/assets/index.css';

interface OptionsState {
  noticeOpen: boolean;
  token: string;
  rootUrl: string;
  playNotifSound: boolean;
  showDesktopNotif: boolean;
  onlyParticipating: boolean;
  reuseTabs: boolean;
  updateCountOnNavigation: boolean;
  useJsDelivr: boolean;
  githubUseMirror: boolean;
  addFolderInfo: boolean;
  visible: boolean;
}

class Options extends React.Component<any, OptionsState> {
  constructor(props: any) {
    super(props);

    this.state = {
      noticeOpen: true,
      token: '',
      rootUrl: '',
      playNotifSound: false,
      showDesktopNotif: true,
      onlyParticipating: false,
      reuseTabs: false,
      updateCountOnNavigation: false,
      useJsDelivr: false,
      githubUseMirror: false,
      addFolderInfo: true,
      visible: false,
    };
  }

  form: any;

  async componentDidMount() {
    const optionData = await optionsStorage.getAll();

    this.setState(optionData);

    const isGuideRead = await localStore.get('isGuideRead');

    if (!isGuideRead) {
      this.showGuide();
      await localStore.set('isGuideRead', true);
    }
  }

  saveField = (fieldName: string, fieldValue: any) => {
    const updateData = { [fieldName]: fieldValue };

    // @ts-ignore
    this.setState(updateData);

    // Programatically changing input value does not trigger input events, so save options manually
    optionsStorage.set(updateData);

    browser.runtime.sendMessage({
      type: 'update',
      data: {
        updated: updateData,
      },
    });
  };

  handleNotifyInputChange = async (checked: boolean) => {
    let isChecked = checked;

    if (isChecked) {
      isChecked = await requestPermission('notifications');
    }

    this.saveField('showDesktopNotif', isChecked);
  };

  handleNoticeSwitchChange = (checked: boolean) => {
    this.saveField('noticeOpen', checked);
  };

  handleParticipatingChange = (checked: boolean) => {
    this.saveField('onlyParticipating', checked);
  };

  handleSoundChange = (checked: boolean) => {
    this.saveField('playNotifSound', checked);
  };

  handleReuseTabsChange = (checked: boolean) => {
    this.saveField('reuseTabs', checked);
  };

  handleTabUpdateChange = (checked: boolean) => {
    this.saveField('updateCountOnNavigation', checked);
  };

  handleUseJsDelivrChange = (checked: boolean) => {
    this.saveField('useJsDelivr', checked);
  };

  handleGitHubMirrorChange = (checked: boolean) => {
    this.saveField('githubUseMirror', checked);
  };

  handleFolderChange = (checked: boolean) => {
    this.saveField('addFolderInfo', checked);
  };

  handleTokenChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    this.saveField('token', e.target.value);
  };

  handleUrlChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    this.saveField('rootUrl', e.target.value);
  };

  showGuide = () => {
    this.setState({ visible: true });
  };

  handleCancel = () => {
    this.setState({ visible: false });

    localStore.set('isGuideRead', true);
  };

  handleGuideClick = () => {
    this.setState({ visible: true });
  };

  render() {
    const {
      noticeOpen,
      rootUrl,
      token,
      onlyParticipating,
      showDesktopNotif,
      playNotifSound,
      reuseTabs,
      updateCountOnNavigation,
      useJsDelivr,
      githubUseMirror,
      addFolderInfo,
      visible,
    } = this.state;

    return (
      <div>
        <form
          id="options-form"
          ref={ins => {
            this.form = ins;
          }}
        >
          <div className="header">
            <Row>
              <Col span={5}>
                <h1>Git Master</h1>
              </Col>
              <Col span={4}>
                <div className="guide" onClick={this.handleGuideClick}>
                  guide
                </div>
              </Col>
            </Row>
          </div>
          <Section title={<Message i18n="github_notifications" />}>
            <SectionOption title={<Message i18n="github_notifications_switch" />} layout="horizontal">
              <Switch checked={noticeOpen} onClick={this.handleNoticeSwitchChange} />
            </SectionOption>
            <SectionOption
              title="Root URL"
              description={
                <div className="small">
                  <Message i18n="notify_github_host_tip" />
                </div>
              }
            >
              <label>
                <input
                  className="master-input github-url"
                  value={rootUrl}
                  onChange={this.handleUrlChange}
                  type="url"
                  name="rootUrl"
                  placeholder="e.g. https://github.yourco.com/"
                />
              </label>
            </SectionOption>

            <SectionOption
              title="Token"
              description={
                <>
                  <div className="small">
                    <Message i18n="notify_github_token_tip" />
                  </div>
                  <div className="small">
                    <Message i18n="notify_github_token_private_tip" />
                  </div>
                </>
              }
            >
              <label>
                <input
                  value={token}
                  onChange={this.handleTokenChange}
                  type="text"
                  name="token"
                  className="master-input github-token"
                  placeholder="a1b2c3d4e5f6g7h8i9j0a1b2c3d4e5f6g7h8i9j0"
                  spellCheck="false"
                />
              </label>
            </SectionOption>

            <SectionOption title={<Message i18n="notify_github_issue" />} layout="horizontal">
              <Switch checked={onlyParticipating} onClick={this.handleParticipatingChange} />
            </SectionOption>

            <SectionOption title={<Message i18n="notify_github_desktop" />} layout="horizontal">
              <Switch checked={showDesktopNotif} onClick={this.handleNotifyInputChange} />
            </SectionOption>

            <SectionOption title={<Message i18n="notify_github_sound" />} layout="horizontal">
              <Switch checked={playNotifSound} onClick={this.handleSoundChange} />
            </SectionOption>

            <SectionOption title={<Message i18n="notify_github_reuse_tab" />} layout="horizontal">
              <Switch checked={reuseTabs} onClick={this.handleReuseTabsChange} />
            </SectionOption>

            <SectionOption title={<Message i18n="notify_github_update_count" />} layout="horizontal">
              <Switch checked={updateCountOnNavigation} onClick={this.handleTabUpdateChange} />
            </SectionOption>
          </Section>

          <Section title="其他">
            <SectionOption
              title={<Message i18n="download_url_use_mirror" />}
              layout="horizontal"
              description={<Message i18n="download_url_use_mirror_desc" />}
            >
              <Switch checked={useJsDelivr} onClick={this.handleUseJsDelivrChange} />
            </SectionOption>
            <SectionOption title={<Message i18n="github_mirror" />} layout="horizontal" description={<Message i18n="github_mirror_desc" />}>
              <Switch checked={githubUseMirror} onClick={this.handleGitHubMirrorChange} />
            </SectionOption>
            <SectionOption title={<Message i18n="github_folder" />} layout="horizontal" description={<Message i18n="github_folder_desc" />}>
              <Switch checked={addFolderInfo} onClick={this.handleFolderChange} />
            </SectionOption>
          </Section>
        </form>
        <Modal width={900} centered visible={visible} onOk={this.showGuide} onCancel={this.handleCancel} footer={null}>
          <img width="100%" src={browser.i18n.getMessage('guide_gif_url')} alt="" />
        </Modal>
      </div>
    );
  }
}

export default Options;
