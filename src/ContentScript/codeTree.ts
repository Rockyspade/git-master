import key from 'key';
import { browser } from 'webextension-polyfill-ts';
import { ADDON_CLASS, DICT, EVENT, PINNED_CLASS, SHOW_CLASS, STORE } from '@/common/core.constants';
import { whichSite } from '@/ContentScript/util';
import tippy from 'tippy.js';
import compareVersions from 'compare-versions';

import gitMaster from '../common/core.api';
import TreeView from '../common/view.tree';
import OptionsView from '../common/view.options';
import HelpPopup from '../common/view.help';
import ErrorView from '../common/view.error';
import extStore from '../common/core.storage';
import GitHub from '../common/adapters/github';
import Gitlab from '../common/adapters/gitlab';
import Oschina from '../common/adapters/oschina';
import Gitea from '../common/adapters/gitea';
import Gist from '../common/adapters/gist';
import Gogs from '../common/adapters/gogs';
import changelog from '../../views/changelog';

import 'tippy.js/dist/tippy.css';
import 'tippy.js/themes/light.css';

async function createAdapter() {
  const siteType = await whichSite();

  // eslint-disable-next-line default-case
  switch (siteType) {
    case DICT.GITHUB:
      return new GitHub();
    case DICT.GITLAB:
      return new Gitlab();
    case DICT.OSCHINA:
      return new Oschina();
    case DICT.GITEA:
      return new Gitea();
    case DICT.GIST:
      return new Gist();
    case DICT.GOGS:
      return new Gogs();
    default:
      return null;
  }
}

interface CodeTreeInstance {
  load: Function;
  tryLoad: Function;
}

class CodeTree {
  public static getSiteType = async () => {
    return await whichSite();
  };

  private $html: any;

  private $document: any;

  private $sidebar: any;

  private $toggler: any;

  private $views: any;

  private $spinner: any;

  private $pinner: any;

  private $version: any;

  private treeView: any;

  private errorView: any;

  private adapter: any;

  private currRepo: any;

  private hasError: any;

  // @ts-ignore
  private repoMeta: any = {};

  private adapterMap: any = {};

  private shouldUpdateVersion = false;

  private instance: CodeTreeInstance = {
    load: () => {},
    tryLoad: () => {},
  };

  public constructor() {
    this.adapterMap = {
      [DICT.GITHUB]: {
        load: this.loadExtension.bind(this),
        tryLoad: this.tryLoadRepo.bind(this),
      },
      [DICT.GITLAB]: {
        load: this.loadExtension.bind(this),
        tryLoad: this.tryLoadRepo.bind(this),
      },
      [DICT.OSCHINA]: {
        load: this.loadExtension.bind(this),
        tryLoad: this.tryLoadRepo.bind(this),
      },
      [DICT.GITEA]: {
        load: this.loadExtension.bind(this),
        tryLoad: this.tryLoadRepo.bind(this),
      },
      [DICT.GIST]: {
        load: this.loadGistExtension.bind(this),
        tryLoad: this.tryLoadGist.bind(this),
      },
      [DICT.GOGS]: {
        load: this.loadExtension.bind(this),
        tryLoad: this.tryLoadRepo.bind(this),
      },
    };
  }

  public async init() {
    const adapter = await createAdapter();

    this.adapter = adapter;

    if (adapter) {
      const matchIns = this.adapterMap[adapter.whoami()];

      if (matchIns) {
        this.instance = matchIns;
      }

      await this.instance.load(adapter);
    }

    return adapter;
  }

  private generateLog(title: string, logs: any, lang: string) {
    if (!logs.length) {
      return '';
    }

    let logHtml = `<h5>${title}</h5><ul>`;

    logs.forEach((feat: { text: any; description: any }) => {
      logHtml += `<li><p>${feat.text[lang]}</p>`;

      if (feat.description?.[lang]) {
        logHtml += `<p class="gitmaster-changelog-description">${feat.description[lang]}</p>`;
      }

      logHtml += '</li>';
    });

    logHtml += '</ul>';

    return logHtml;
  }

  private generateChangelog(version: string, lang: string) {
    let features = this.generateLog('🚀 Features', changelog.feature, lang);
    let fixes = this.generateLog('🐛 Bug fixes', changelog.fix, lang);

    return `
           <div class="gitmaster-changelog">
              <div class="gitmaster-changelog-title">
                <h3>${version}</h3>
              </div>
              <div class="gitmaster-changelog-features">
               ${features}
              </div>
                <div class="gitmaster-changelog-fixes">
               ${fixes}
              </div>
           </div>
          `;
  }

  private async loadGistExtension(adapter: any, activationOpts = {}) {
    this.$html = $('html');
    this.$document = $(document);
    const $dom = $(TEMPLATE);
    this.$sidebar = $dom.find('.gitmaster-sidebar');
    this.$toggler = this.$sidebar.find('.gitmaster-toggle').hide();
    this.$views = this.$sidebar.find('.gitmaster-view');
    this.$spinner = this.$sidebar.find('.gitmaster-spin');
    this.$pinner = this.$sidebar.find('.gitmaster-pin');
    this.treeView = new TreeView($dom, adapter);
    const optsView = new OptionsView($dom, adapter, this.$sidebar);
    const helpPopup = new HelpPopup($dom);
    this.errorView = new ErrorView($dom);

    this.adapter = adapter;
    this.currRepo = false;
    this.hasError = false;

    this.$pinner.click(this.togglePin);
    await this.setupSidebarFloatingBehaviors();
    this.setHotkeys(await extStore.get(STORE.HOTKEYS));

    if (!this.$html.hasClass(ADDON_CLASS)) this.$html.addClass(ADDON_CLASS);

    $(window).resize(event => {
      if (event.target === window) this.layoutChanged();
    });

    const showView = this.showView;
    const $document = this.$document;
    const treeView = this.treeView;

    for (const view of [this.treeView, this.errorView, optsView]) {
      $(view)
        // eslint-disable-next-line no-loop-func
        .on(EVENT.VIEW_READY, async function() {
          // eslint-disable-next-line @typescript-eslint/no-invalid-this
          if (this !== optsView) {
            console.log('reday');
            $document.trigger(EVENT.REQ_END);

            optsView.$toggler.removeClass('selected');

            if (adapter.isOnPRPage && (await extStore.get(STORE.PR))) {
              treeView.$tree.jstree('open_all');
            }
          }
          // eslint-disable-next-line @typescript-eslint/no-invalid-this
          showView(this);
        })
        .on(EVENT.VIEW_CLOSE, (_event: any, data: any) => {
          if (data?.showSettings) {
            optsView.toggle(true);
          } else {
            showView(this.hasError ? this.errorView : this.treeView);
          }
        })
        .on(EVENT.FETCH_ERROR, (_event: any, err: any) => this.showError(err));
    }

    $(extStore).on(EVENT.STORE_CHANGE, this.optionsChanged);

    this.$document
      .on(EVENT.REQ_START, () => this.$spinner.addClass('gitmaster-spin--loading'))
      .on(EVENT.REQ_END, () => this.$spinner.removeClass('gitmaster-spin--loading'))
      .on(EVENT.LAYOUT_CHANGE, this.layoutChanged)
      .on(EVENT.TOGGLE_PIN, this.layoutChanged)
      .on(EVENT.LOC_CHANGE, (_event: any, reload = false) => this.instance.tryLoad(reload));

    this.$sidebar
      .addClass(adapter.getCssClass())
      .width(Math.min(parseInt(await extStore.get(STORE.WIDTH), 10), 1000))
      .resize(() => this.layoutChanged(true))
      .appendTo($('body'));

    this.$document.trigger(EVENT.SIDEBAR_HTML_INSERTED);

    adapter.init(this.$sidebar);
    await helpPopup.init();

    await gitMaster.activate(
      {
        adapter,
        $document: this.$document,
        $dom,
        $sidebar: this.$sidebar,
        $toggler: this.$toggler,
        $views: this.$views,
        treeView: this.treeView,
        optsView,
        errorView: this.errorView,
      },
      activationOpts
    );

    return this.instance.tryLoad();
  }

  private async loadExtension(adapter: any, activationOpts = {}) {
    this.$html = $('html');
    this.$document = $(document);
    const $dom = $(TEMPLATE);
    this.$sidebar = $dom.find('.gitmaster-sidebar');
    this.$toggler = this.$sidebar.find('.gitmaster-toggle').hide();
    this.$views = this.$sidebar.find('.gitmaster-view');
    this.$spinner = this.$sidebar.find('.gitmaster-spin');
    this.$pinner = this.$sidebar.find('.gitmaster-pin');
    this.$version = this.$sidebar.find('#gitmaster-version');
    this.treeView = new TreeView($dom, adapter);
    const optsView = new OptionsView($dom, adapter, this.$sidebar);
    const helpPopup = new HelpPopup($dom);
    this.errorView = new ErrorView($dom);

    this.adapter = adapter;
    this.currRepo = false;
    this.hasError = false;

    this.$pinner.click(this.togglePin);
    await this.setupSidebarFloatingBehaviors();
    this.setHotkeys(await extStore.get(STORE.HOTKEYS));

    if (!this.$html.hasClass(ADDON_CLASS)) this.$html.addClass(ADDON_CLASS);

    $(window).resize(event => {
      if (event.target === window) this.layoutChanged();
    });

    const showView = this.showView;
    const $document = this.$document;
    const treeView = this.treeView;

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    for (const view of [this.treeView, this.errorView, optsView]) {
      $(view)
        // eslint-disable-next-line no-loop-func
        .on(EVENT.VIEW_READY, async function() {
          // eslint-disable-next-line @typescript-eslint/no-invalid-this
          if (this !== optsView) {
            $document.trigger(EVENT.REQ_END);

            optsView.$toggler.removeClass('selected');

            if (adapter.isOnPRPage && (await extStore.get(STORE.PR))) {
              treeView.$tree.jstree('open_all');
            }

            // eslint-disable-next-line @typescript-eslint/no-invalid-this
            if (this === self.treeView && self.shouldUpdateVersion) {
              await self.setChangelogVersion();
            }
          }
          // eslint-disable-next-line @typescript-eslint/no-invalid-this
          showView(this);
        })
        .on(EVENT.VIEW_CLOSE, (_event: any, data: any) => {
          if (data?.showSettings) {
            optsView.toggle(true);
          } else {
            showView(this.hasError ? this.errorView : this.treeView);
          }
        })
        .on(EVENT.FETCH_ERROR, (_event: any, err: any) => this.showError(err));
    }

    $(extStore).on(EVENT.STORE_CHANGE, this.optionsChanged);

    this.$document
      .on(EVENT.REQ_START, () => this.$spinner.addClass('gitmaster-spin--loading'))
      .on(EVENT.REQ_END, () => this.$spinner.removeClass('gitmaster-spin--loading'))
      .on(EVENT.LAYOUT_CHANGE, this.layoutChanged)
      .on(EVENT.TOGGLE_PIN, this.layoutChanged)
      .on(EVENT.LOC_CHANGE, (_event: any, reload = false) => this.instance.tryLoad(reload));

    this.$sidebar
      .addClass(adapter.getCssClass())
      .width(Math.min(parseInt(await extStore.get(STORE.WIDTH), 10), 1000))
      .resize(() => this.layoutChanged(true))
      .appendTo($('body'));

    this.$document.trigger(EVENT.SIDEBAR_HTML_INSERTED);

    adapter.init(this.$sidebar);
    await helpPopup.init();

    await gitMaster.activate(
      {
        adapter,
        $document: this.$document,
        $dom,
        $sidebar: this.$sidebar,
        $toggler: this.$toggler,
        $views: this.$views,
        treeView: this.treeView,
        optsView,
        errorView: this.errorView,
      },
      activationOpts
    );

    await this.initChangelog();

    return this.instance.tryLoad();
  }

  private async setChangelogVersion() {
    const { version } = browser.runtime.getManifest();

    setTimeout(async () => {
      await extStore.set(STORE.CURRENT_VERSION, version);
    }, 10 * 1000);
  }

  private async initChangelog() {
    const { version } = browser.runtime.getManifest();
    const lang = browser.i18n.getMessage('@@ui_locale');

    const lastVersion = await extStore.get(STORE.CURRENT_VERSION);

    $(`<span>v${version}</span>`).appendTo(this.$version);

    if (compareVersions(version, lastVersion || '0') > 0) {
      $('<span style="color:#ff4d4f">(New)</span>').appendTo(this.$version);
      this.shouldUpdateVersion = true;
    }

    tippy(this.$version.get(0), {
      content: this.generateChangelog(version, lang),
      allowHTML: true,
      interactive: true,
      maxWidth: 400,
      trigger: 'click',
      zIndex: 1000000002,
      offset: [0, 20],
      theme: 'light',
      popperOptions: {
        strategy: 'fixed',
      },
    });
  }

  /**
   * Invoked when the user saves the option changes in the option view.
   * @param {!string} event
   * @param {!Object<!string, [(string|boolean), (string|boolean)]>} changes
   */
  private optionsChanged = async (_event: any, changes: any) => {
    let reload = false;

    Object.keys(changes).forEach(storeKey => {
      const [oldValue, newValue] = changes[storeKey];

      // eslint-disable-next-line default-case
      switch (storeKey) {
        case STORE.GITHUB_TOKEN:
        case STORE.GITLAB_TOKEN:
        case STORE.GITEE_TOKEN:
        case STORE.GOGS_TOKEN:
        case STORE.LAZYLOAD:
        case STORE.ICONS:
        case STORE.FILESIZE:
          reload = true;
          break;
        case STORE.PR:
          reload = this.adapter.isOnPRPage;
          break;
        case STORE.HOVEROPEN:
          this.handleHoverOpenOption(newValue);
          break;
        case STORE.HOTKEYS:
          this.setHotkeys(newValue, oldValue);
          break;
        case STORE.PINNED:
          this.onPinToggled(newValue);
          break;
      }
    });

    if (await gitMaster.applyOptions(changes)) {
      reload = true;
    }

    if (reload) {
      await this.instance.tryLoad(true);
    }
  };

  private async tryLoadGist(reload?: boolean) {
    const token = await this.adapter.getAccessToken();

    try {
      await this.adapter.getRepoFromPath(this.currRepo, token, async (err: any, repo: any) => {
        if (err) {
          // Error making API, likely private repo but no token
          await this.showError(err);
          if (!this.isSidebarVisible()) {
            this.$toggler.show();
          }
        } else if (repo) {
          if ((await extStore.get(STORE.PINNED)) && !this.isSidebarVisible()) {
            // If we're in pin mode but sidebar doesn't show yet, show it.
            // Note if we're from another page back to code page, sidebar is "pinned", but not visible.
            if (this.isSidebarPinned()) {
              await this.toggleSidebar();
            } else {
              await this.onPinToggled(true);
            }
          } else if (this.isSidebarVisible()) {
            const replacer = ['username', 'reponame', 'branch', 'pullNumber'];
            const repoChanged = JSON.stringify(repo, replacer) !== JSON.stringify(this.currRepo, replacer);
            if (repoChanged || reload === true) {
              this.hasError = false;
              this.$document.trigger(EVENT.REQ_START);
              this.currRepo = repo;
              this.treeView.show(repo, token);
            } else {
              await this.treeView.syncSelection(repo);
            }

            this.$pinner.find('.master-tooltip').attr('aria-label', browser.i18n.getMessage('pin_sidebar_tip'));
          } else {
            // Sidebar not visible (because it's not pinned), show the toggler
            this.$toggler.show();

            this.$pinner.find('.master-tooltip').attr('aria-label', browser.i18n.getMessage('pin_sidebar_tip'));
          }
        } else {
          // Not a repo or not to be shown in this page
          this.$toggler.hide();
          this.toggleSidebar(false);
        }
        await this.layoutChanged();
      });
    } catch (e) {}
  }

  private async tryLoadRepo(reload?: boolean) {
    const token = await this.adapter.getAccessToken();
    try {
      await this.adapter.getRepoFromPath(this.currRepo, token, async (err: any, repo: any) => {
        if (err) {
          // Error making API, likely private repo but no token
          await this.showError(err);
          if (!this.isSidebarVisible()) {
            this.$toggler.show();
          }
        } else if (repo) {
          if ((await extStore.get(STORE.PINNED)) && !this.isSidebarVisible()) {
            // If we're in pin mode but sidebar doesn't show yet, show it.
            // Note if we're from another page back to code page, sidebar is "pinned", but not visible.
            if (this.isSidebarPinned()) {
              await this.toggleSidebar();
            } else {
              await this.onPinToggled(true);
            }
          } else if (this.isSidebarVisible()) {
            const replacer = ['username', 'reponame', 'branch', 'pullNumber'];
            const repoChanged = JSON.stringify(repo, replacer) !== JSON.stringify(this.currRepo, replacer);
            if (repoChanged || reload === true) {
              this.hasError = false;
              this.$document.trigger(EVENT.REQ_START);
              this.currRepo = repo;
              this.treeView.show(repo, token);
            } else {
              await this.treeView.syncSelection(repo);
            }
          } else {
            // Sidebar not visible (because it's not pinned), show the toggler
            this.$toggler.show();
          }

          // fetch repo data
          const metaData = await this.adapter.getContent('', {
            repo: repo,
            isRepoMetaData: true,
          });

          if (metaData) {
            this.repoMeta = metaData;
            window.RepoMeta = metaData;
          }
        } else {
          // Not a repo or not to be shown in this page
          this.$toggler.hide();
          this.toggleSidebar(false);
        }
        await this.layoutChanged();
      });
    } catch (e) {}
  }

  private showView = (view: any) => {
    this.$views.removeClass('current');
    view.$view.addClass('current');
    $(view).trigger(EVENT.VIEW_SHOW);
  };

  private async showError(err: any) {
    this.hasError = true;
    this.errorView.show(err);

    if (await extStore.get(STORE.PINNED)) await this.togglePin(true);
  }

  private async toggleSidebar(visibility?: boolean) {
    if (visibility !== undefined) {
      if (this.isSidebarVisible() === visibility) return;
      await this.toggleSidebar();
    } else {
      this.$html.toggleClass(SHOW_CLASS);
      this.$document.trigger(EVENT.TOGGLE, this.isSidebarVisible());

      // Ensure the repo is loaded when the sidebar shows after being hidden.
      // Note that tryLoadRepo() already takes care of not reloading if nothing changes.
      if (this.isSidebarVisible()) {
        this.$toggler.show();
        await this.instance.tryLoad();
      }
    }

    return visibility;
  }

  private togglePin = async (isPinned?: boolean): Promise<boolean> => {
    if (isPinned !== undefined) {
      if (this.isSidebarPinned() === isPinned) {
        // @ts-ignore
        return;
      }
      return this.togglePin();
    }

    const sidebarPinned = !this.isSidebarPinned();
    await extStore.set(STORE.PINNED, sidebarPinned);
    return sidebarPinned;
  };

  private async onPinToggled(isPinned: boolean) {
    if (isPinned === this.isSidebarPinned()) {
      return;
    }

    this.$pinner.toggleClass(PINNED_CLASS);

    const sidebarPinned = this.isSidebarPinned();

    this.$pinner
      .find('.master-tooltip')
      .attr('aria-label', sidebarPinned ? browser.i18n.getMessage('unpin_sidebar_tip') : browser.i18n.getMessage('pin_sidebar_tip'));
    this.$document.trigger(EVENT.TOGGLE_PIN, sidebarPinned);
    await this.toggleSidebar(sidebarPinned);
  }

  private layoutChanged = async (save = false) => {
    const width = this.$sidebar.outerWidth();

    const isLeft = await this.isSidebarLeft();
    this.adapter.updateLayout(this.isSidebarPinned(), this.isSidebarVisible(), width, isLeft);
    if (save === true) {
      await extStore.set(STORE.WIDTH, width);
    }
  };

  /**
   * Controls how the sidebar behaves in float mode (i.e. non-pinned).
   */
  private async setupSidebarFloatingBehaviors() {
    const MOUSE_LEAVE_DELAY = 400;
    const KEY_PRESS_DELAY = 4000;
    let isMouseInSidebar = false;

    this.handleHoverOpenOption(await extStore.get(STORE.HOVEROPEN));

    // Immediately closes if click outside the sidebar.
    this.$document.on('click', () => {
      if (!isMouseInSidebar && !this.isSidebarPinned() && this.isSidebarVisible()) {
        this.toggleSidebar(false);
      }
    });

    let timerId: number | null = null;

    const clearTimer = () => {
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
    };

    const startTimer = (delay: number) => {
      if (!isMouseInSidebar && !this.isSidebarPinned()) {
        clearTimer();
        // @ts-ignore
        timerId = setTimeout(() => this.toggleSidebar(this.isSidebarPinned()), delay);
      }
    };

    this.$document.on('mouseover', () => {
      // Ensure startTimer being executed only once when mouse is moving outside the sidebar
      if (!timerId) {
        isMouseInSidebar = false;
        startTimer(MOUSE_LEAVE_DELAY);
      }
    });

    this.$sidebar
      .on('keyup', () => startTimer(KEY_PRESS_DELAY))
      .on('mouseover', (event: MouseEvent) => {
        // Prevent mouseover from propagating to document
        event.stopPropagation();
      })
      .on('mousemove', (event: MouseEvent) => {
        // Don't do anything while hovering on Toggler
        const isHoveringToggler = this.$toggler.is(event.target) || this.$toggler.has(event.target).length;
        if (isHoveringToggler) return;

        isMouseInSidebar = true;
        clearTimer();

        if (!this.isSidebarVisible()) {
          this.toggleSidebar(true);
        }
      });
  }

  private onTogglerHovered = () => {
    this.toggleSidebar(true);
  };

  private onTogglerClicked = (event: MouseEvent) => {
    event.stopPropagation();
    this.toggleSidebar(true);
  };

  private handleHoverOpenOption(enableHoverOpen: string) {
    if (enableHoverOpen) {
      this.$toggler.off('click', this.onTogglerClicked);
      this.$toggler.on('mouseenter', this.onTogglerHovered);
    } else {
      this.$toggler.off('mouseenter', this.onTogglerHovered);
      this.$toggler.on('click', this.onTogglerClicked);
    }
  }

  /**
   * Set new hot keys to pin or unpin the sidebar.
   * @param {string} newKeys
   * @param {string?} oldKeys
   */
  private setHotkeys(newKeys: string, oldKeys?: string) {
    key.filter = () => this.$sidebar.is(':visible');
    if (oldKeys) key.unbind(oldKeys);
    key(newKeys, async () => {
      if (await this.togglePin()) this.treeView.focus();
    });
  }

  private isSidebarVisible() {
    return this.$html.hasClass(SHOW_CLASS);
  }

  private isSidebarPinned() {
    return this.$pinner.hasClass(PINNED_CLASS);
  }

  private async isSidebarLeft() {
    const direction = await extStore.get(STORE.DIRECTION);
    return direction === 'left';
  }
}

export default CodeTree;
