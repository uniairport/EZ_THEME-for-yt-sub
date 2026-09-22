<template>
  <main class="access-points-page">
    <div class="access-points-shell">
      <header class="page-heading">
        <div class="heading-icon" aria-hidden="true">
          <IconRoute :size="28" :stroke-width="1.8" />
        </div>
        <div class="heading-copy">
          <div class="heading-row">
            <h1>接入点设置</h1>
            <span v-if="!loading && !error" class="node-count">{{ nodes.length }} 个节点</span>
          </div>
          <p>为每个节点选择连接入口，保存后将在下次更新订阅时生效。</p>
        </div>
      </header>

      <section class="notice-strip" aria-label="使用说明">
        <IconInfoCircle :size="20" :stroke-width="1.8" />
        <p>这里只显示线路名称，不展示接入地址。节点端口、协议参数与节点名称均保持不变。</p>
      </section>

      <section v-if="loading" class="state-panel" aria-live="polite" aria-busy="true">
        <div class="skeleton-toolbar skeleton"></div>
        <div v-for="item in 4" :key="item" class="skeleton-node">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton-options">
            <div class="skeleton skeleton-chip"></div>
            <div class="skeleton skeleton-chip skeleton-chip-short"></div>
          </div>
        </div>
        <span class="sr-only">正在加载接入点设置</span>
      </section>

      <section v-else-if="error" class="state-panel error-panel" role="alert">
        <div class="state-icon error-icon">
          <IconPlugConnectedX :size="32" :stroke-width="1.7" />
        </div>
        <h2>{{ unavailable ? '接入点功能当前未启用' : '接入点设置加载失败' }}</h2>
        <p>{{ error }}</p>
        <div class="state-actions">
          <button v-if="!unavailable" type="button" class="secondary-button" @click="loadSettings">
            <IconRefresh :size="18" />
            重新加载
          </button>
          <button type="button" class="text-button" @click="$router.push('/dashboard')">
            <IconArrowLeft :size="18" />
            返回仪表盘
          </button>
        </div>
      </section>

      <template v-else>
        <div v-if="nodes.length" class="list-toolbar">
          <label class="search-box">
            <IconSearch :size="19" :stroke-width="1.8" aria-hidden="true" />
            <span class="sr-only">搜索节点</span>
            <input v-model.trim="searchTerm" type="search" placeholder="搜索节点名称" autocomplete="off" />
          </label>
          <span class="result-summary">
            {{ searchTerm ? `找到 ${filteredNodes.length} 个节点` : '逐节点选择线路' }}
          </span>
        </div>

        <section v-if="!nodes.length" class="state-panel empty-panel">
          <div class="state-icon">
            <IconServerOff :size="32" :stroke-width="1.7" />
          </div>
          <h2>暂无可设置的节点</h2>
          <p>当前套餐没有可用节点，套餐恢复可用后会在这里显示。</p>
        </section>

        <section v-else-if="!filteredNodes.length" class="state-panel empty-panel">
          <div class="state-icon">
            <IconSearchOff :size="32" :stroke-width="1.7" />
          </div>
          <h2>没有匹配的节点</h2>
          <p>换一个节点名称再试。</p>
          <button type="button" class="text-button" @click="searchTerm = ''">清除搜索</button>
        </section>

        <form v-else class="node-list" @submit.prevent="saveAll">
          <article v-for="node in filteredNodes" :key="node.server_id" class="node-card">
            <div class="node-heading">
              <div class="node-identity">
                <div class="node-icon" aria-hidden="true">
                  <IconServer :size="21" :stroke-width="1.8" />
                </div>
                <div>
                  <h2>{{ node.server_name }}</h2>
                  <div class="node-meta">
                    <span>{{ formatProtocol(node.server_type) }}</span>
                    <span aria-hidden="true">·</span>
                    <span>{{ node.options.length }} 条线路</span>
                  </div>
                </div>
              </div>
              <span v-if="isNodeChanged(node)" class="changed-mark">
                <IconPencil :size="14" />
                已修改
              </span>
            </div>

            <fieldset class="route-options">
              <legend class="sr-only">为 {{ node.server_name }} 选择接入点</legend>
              <label
                v-for="option in node.options"
                :key="option.id"
                class="route-option"
                :class="{ selected: selections[node.server_id] === option.id }"
              >
                <input
                  v-model="selections[node.server_id]"
                  type="radio"
                  :name="`server-${node.server_id}`"
                  :value="option.id"
                />
                <span class="radio-control" aria-hidden="true"></span>
                <span class="option-name">{{ option.name }}</span>
                <span v-if="option.is_original" class="default-mark">默认</span>
              </label>
            </fieldset>
          </article>
        </form>

        <div v-if="nodes.length" class="save-dock" :class="{ dirty: dirtyCount > 0 }">
          <div class="save-status" aria-live="polite">
            <IconCircleCheck v-if="dirtyCount === 0" :size="21" :stroke-width="1.8" />
            <IconEditCircle v-else :size="21" :stroke-width="1.8" />
            <div>
              <strong>{{ dirtyCount ? `已修改 ${dirtyCount} 个节点` : '所有设置已保存' }}</strong>
              <span>{{ dirtyCount ? '保存后请在客户端更新订阅' : '当前订阅将使用已保存的接入点' }}</span>
            </div>
          </div>
          <button
            type="button"
            class="save-button"
            :disabled="dirtyCount === 0 || saving"
            @click="saveAll"
          >
            <IconLoader2 v-if="saving" class="spin" :size="19" />
            <IconDeviceFloppy v-else :size="19" />
            {{ saving ? '正在保存' : '保存全部' }}
          </button>
        </div>
      </template>
    </div>
  </main>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  IconArrowLeft,
  IconCircleCheck,
  IconDeviceFloppy,
  IconEditCircle,
  IconInfoCircle,
  IconLoader2,
  IconPencil,
  IconPlugConnectedX,
  IconRefresh,
  IconRoute,
  IconSearch,
  IconSearchOff,
  IconServer,
  IconServerOff
} from '@tabler/icons-vue';
import { fetchAccessPointSettings, saveAccessPointSelections } from '@/api/accessPoints';
import { useToast } from '@/composables/useToast';

const router = useRouter();
const { showToast } = useToast();

const loading = ref(true);
const saving = ref(false);
const unavailable = ref(false);
const error = ref('');
const searchTerm = ref('');
const nodes = ref([]);
const selections = reactive({});
const savedSelections = ref({});

const filteredNodes = computed(() => {
  const keyword = searchTerm.value.toLocaleLowerCase('zh-CN');
  if (!keyword) return nodes.value;

  return nodes.value.filter(node =>
    node.server_name.toLocaleLowerCase('zh-CN').includes(keyword)
  );
});

const dirtyCount = computed(() => nodes.value.reduce((count, node) => (
  selections[node.server_id] !== savedSelections.value[node.server_id] ? count + 1 : count
), 0));

const errorMessage = errorObject => (
  errorObject?.response?.message
  || errorObject?.response?.data?.message
  || errorObject?.message
  || '网络连接异常，请稍后重试。'
);

const loadSettings = async () => {
  loading.value = true;
  error.value = '';
  unavailable.value = false;

  try {
    const response = await fetchAccessPointSettings();
    const data = response?.data;
    if (!data?.enabled || !Array.isArray(data.nodes)) {
      throw new Error('服务返回的数据格式不正确。');
    }

    nodes.value = data.nodes;
    const nextSelections = {};
    data.nodes.forEach(node => {
      nextSelections[node.server_id] = node.selected_id;
      selections[node.server_id] = node.selected_id;
    });
    savedSelections.value = nextSelections;
  } catch (requestError) {
    const status = requestError?.response?.status;
    unavailable.value = status === 404 || status === 400;
    error.value = unavailable.value
      ? '管理员启用节点接入点插件后，此页面会自动恢复。'
      : errorMessage(requestError);
    nodes.value = [];
  } finally {
    loading.value = false;
  }
};

const saveAll = async () => {
  if (saving.value || dirtyCount.value === 0) return;

  saving.value = true;
  try {
    const payload = nodes.value.map(node => ({
      server_id: node.server_id,
      access_point_id: selections[node.server_id]
    }));
    const response = await saveAccessPointSelections(payload);
    savedSelections.value = { ...selections };
    showToast.success(response?.message || '接入点设置已保存');
  } catch (requestError) {
    showToast.error(errorMessage(requestError));
  } finally {
    saving.value = false;
  }
};

const isNodeChanged = node => (
  selections[node.server_id] !== savedSelections.value[node.server_id]
);

const formatProtocol = type => {
  const names = {
    shadowsocks: 'Shadowsocks',
    vmess: 'VMess',
    vless: 'VLESS',
    trojan: 'Trojan',
    hysteria: 'Hysteria',
    tuic: 'TUIC',
    anytls: 'AnyTLS',
    socks: 'SOCKS',
    naive: 'Naive',
    http: 'HTTP',
    mieru: 'Mieru'
  };
  return names[String(type).toLowerCase()] || String(type).toUpperCase();
};

onMounted(loadSettings);
</script>

<style lang="scss" scoped>
.access-points-page {
  padding: 20px;
  padding-bottom: 96px;
  color: var(--text-color);
}

.access-points-shell {
  width: 100%;
  max-width: 1120px;
  margin: 0 auto;
}

.page-heading {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-bottom: 18px;
  padding: 22px 24px;
  border: 1px solid var(--card-border-color, var(--border-color));
  border-radius: 16px;
  background: var(--card-background);
}

.heading-icon,
.node-icon,
.state-icon {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  color: var(--theme-color);
  background: rgba(var(--theme-color-rgb), 0.1);
}

.heading-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
}

.heading-copy {
  min-width: 0;
  flex: 1;
}

.heading-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.heading-row h1 {
  margin: 0;
  font-size: clamp(22px, 3vw, 28px);
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.heading-copy p {
  margin: 7px 0 0;
  color: var(--secondary-text-color);
  line-height: 1.6;
}

.node-count,
.changed-mark,
.default-mark {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  font-weight: 600;
}

.node-count {
  padding: 4px 9px;
  border-radius: 8px;
  color: var(--theme-color);
  background: rgba(var(--theme-color-rgb), 0.09);
  font-size: 12px;
}

.notice-strip {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 20px;
  padding: 13px 16px;
  border-left: 3px solid var(--theme-color);
  border-radius: 4px 12px 12px 4px;
  background: rgba(var(--theme-color-rgb), 0.07);
  color: var(--secondary-text-color);
}

.notice-strip svg {
  flex: 0 0 auto;
  margin-top: 1px;
  color: var(--theme-color);
}

.notice-strip p {
  margin: 0;
  font-size: 14px;
  line-height: 1.55;
}

.list-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 9px;
  width: min(100%, 360px);
  height: 42px;
  padding: 0 13px;
  border: 1px solid var(--card-border-color, var(--border-color));
  border-radius: 10px;
  background: var(--card-background);
  color: var(--secondary-text-color);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.search-box:focus-within {
  border-color: var(--theme-color);
  box-shadow: 0 0 0 3px rgba(var(--theme-color-rgb), 0.12);
}

.search-box input {
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-color);
  font: inherit;
}

.search-box input::placeholder {
  color: var(--secondary-text-color);
  opacity: 0.72;
}

.result-summary {
  color: var(--secondary-text-color);
  font-size: 13px;
}

.node-list {
  display: grid;
  gap: 12px;
}

.node-card {
  padding: 19px 20px 20px;
  border: 1px solid var(--card-border-color, var(--border-color));
  border-radius: 14px;
  background: var(--card-background);
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.node-card:hover {
  border-color: var(--card-hover-border-color, rgba(var(--theme-color-rgb), 0.35));
}

.node-heading,
.node-identity {
  display: flex;
  align-items: center;
}

.node-heading {
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.node-identity {
  min-width: 0;
  gap: 11px;
}

.node-icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
}

.node-identity h2 {
  margin: 0;
  overflow: hidden;
  color: var(--text-color);
  font-size: 16px;
  font-weight: 650;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 4px;
  color: var(--secondary-text-color);
  font-size: 12px;
}

.changed-mark {
  gap: 4px;
  color: var(--theme-color);
  font-size: 12px;
}

.route-options {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  margin: 0;
  padding: 0;
  border: 0;
}

.route-option {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 8px 12px;
  border: 1px solid var(--card-border-color, var(--border-color));
  border-radius: 10px;
  background: var(--card-background);
  color: var(--text-color);
  cursor: pointer;
  user-select: none;
  transition: border-color 0.2s ease, background-color 0.2s ease, transform 0.15s ease;
}

.route-option:hover {
  border-color: rgba(var(--theme-color-rgb), 0.55);
}

.route-option:active {
  transform: scale(0.985);
}

.route-option.selected {
  border-color: var(--theme-color);
  background: rgba(var(--theme-color-rgb), 0.08);
}

.route-option input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.route-option:focus-within {
  outline: 3px solid rgba(var(--theme-color-rgb), 0.16);
  outline-offset: 2px;
}

.radio-control {
  position: relative;
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  border: 1.5px solid var(--secondary-text-color);
  border-radius: 50%;
}

.selected .radio-control {
  border-color: var(--theme-color);
}

.selected .radio-control::after {
  position: absolute;
  inset: 3px;
  border-radius: 50%;
  background: var(--theme-color);
  content: '';
}

.option-name {
  font-size: 14px;
  line-height: 1.35;
}

.default-mark {
  padding: 2px 6px;
  border-radius: 5px;
  color: var(--secondary-text-color);
  background: rgba(var(--text-color-rgb), 0.07);
  font-size: 10px;
}

.save-dock {
  position: sticky;
  z-index: 10;
  bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-top: 18px;
  padding: 13px 14px 13px 17px;
  border: 1px solid var(--card-border-color, var(--border-color));
  border-radius: 14px;
  background: rgba(var(--card-background-rgb), 0.92);
  box-shadow: 0 12px 34px rgba(17, 24, 39, 0.1);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.save-dock.dirty {
  border-color: rgba(var(--theme-color-rgb), 0.5);
}

.save-status {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
  color: var(--theme-color);
}

.save-status div {
  display: grid;
  gap: 2px;
}

.save-status strong {
  color: var(--text-color);
  font-size: 14px;
}

.save-status span {
  color: var(--secondary-text-color);
  font-size: 12px;
}

.save-button,
.secondary-button,
.text-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 40px;
  border-radius: 10px;
  font: inherit;
  font-size: 14px;
  font-weight: 650;
  cursor: pointer;
  transition: transform 0.15s ease, opacity 0.2s ease, border-color 0.2s ease;
}

.save-button {
  min-width: 126px;
  padding: 9px 17px;
  border: 1px solid var(--theme-color);
  background: var(--theme-color);
  color: #fff;
}

.save-button:hover:not(:disabled),
.secondary-button:hover,
.text-button:hover {
  transform: translateY(-1px);
}

.save-button:disabled {
  border-color: var(--border-color);
  background: rgba(var(--text-color-rgb), 0.08);
  color: var(--secondary-text-color);
  cursor: not-allowed;
  opacity: 0.75;
}

.secondary-button,
.text-button {
  padding: 8px 14px;
}

.secondary-button {
  border: 1px solid var(--theme-color);
  background: rgba(var(--theme-color-rgb), 0.08);
  color: var(--theme-color);
}

.text-button {
  border: 1px solid transparent;
  background: transparent;
  color: var(--secondary-text-color);
}

.state-panel {
  display: grid;
  place-items: center;
  min-height: 250px;
  padding: 32px;
  border: 1px solid var(--card-border-color, var(--border-color));
  border-radius: 14px;
  background: var(--card-background);
  text-align: center;
}

.state-panel h2 {
  margin: 14px 0 6px;
  font-size: 18px;
}

.state-panel p {
  max-width: 460px;
  margin: 0;
  color: var(--secondary-text-color);
  line-height: 1.6;
}

.state-icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
}

.error-icon {
  color: var(--error-color);
  background: var(--error-background);
}

.state-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 20px;
}

.skeleton-node {
  width: 100%;
  padding: 18px 0;
  border-bottom: 1px solid var(--border-color);
}

.skeleton-node:last-child {
  border-bottom: 0;
}

.skeleton {
  border-radius: 8px;
  background: linear-gradient(
    90deg,
    rgba(var(--text-color-rgb), 0.06) 20%,
    rgba(var(--text-color-rgb), 0.12) 38%,
    rgba(var(--text-color-rgb), 0.06) 58%
  );
  background-size: 300% 100%;
  animation: skeleton-shimmer 1.4s ease infinite;
}

.skeleton-toolbar {
  justify-self: start;
  width: 280px;
  max-width: 100%;
  height: 40px;
  margin-bottom: 10px;
}

.skeleton-title {
  width: 34%;
  height: 18px;
}

.skeleton-options {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}

.skeleton-chip {
  width: 148px;
  height: 40px;
}

.skeleton-chip-short {
  width: 116px;
}

.spin {
  animation: spin 0.8s linear infinite;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@keyframes skeleton-shimmer {
  to { background-position: -100% 0; }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .access-points-page {
    padding: 12px;
    padding-bottom: 112px;
  }

  .page-heading {
    align-items: flex-start;
    padding: 18px;
  }

  .heading-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
  }

  .heading-row {
    align-items: flex-start;
    flex-direction: column;
    gap: 7px;
  }

  .list-toolbar {
    align-items: stretch;
    flex-direction: column;
    gap: 8px;
  }

  .search-box {
    width: 100%;
  }

  .node-card {
    padding: 16px;
  }

  .node-heading {
    align-items: flex-start;
  }

  .route-options {
    display: grid;
    grid-template-columns: 1fr;
  }

  .route-option {
    width: 100%;
  }

  .save-dock {
    bottom: 78px;
    align-items: stretch;
    flex-direction: column;
    gap: 12px;
  }

  .save-button {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton,
  .spin {
    animation: none;
  }

  .route-option,
  .save-button,
  .secondary-button,
  .text-button {
    transition: none;
  }
}
</style>
