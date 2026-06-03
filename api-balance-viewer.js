// API余额查看器 v6.0.0 - 自动更新 + UITable 交互界面
// 作者：小A | 支持：DeepSeek/OpenAI/Anthropic/阿里云/腾讯混元/Kimi/智谱GLM/自定义
// 远程更新地址: https://github.com/Chilam-Y66/scriptable-scripts

// ========== 自动更新模块 ==========
var SCRIPT_NAME = "api-bal-viewer";
var SCRIPT_URL = "https://raw.githubusercontent.com/Chilam-Y66/scriptable-scripts/main/api-balance-viewer-main.js";
var fm = FileManager.local();
var runDir = fm.joinPath(fm.documentsDirectory(), SCRIPT_NAME);
var moduleDir = fm.joinPath(runDir, "Running");

if (!fm.fileExists(runDir)) fm.createDirectory(runDir);
if (!fm.fileExists(moduleDir)) fm.createDirectory(moduleDir);

function downloadModule() {
  var now = new Date();
  var df = new DateFormatter();
  df.dateFormat = "yyyyMMddHH";
  var moduleFilename = df.string(now) + ".js";
  var modulePath = fm.joinPath(moduleDir, moduleFilename);

  // 如果本地已有最新版则直接使用
  if (fm.fileExists(modulePath)) {
    return new Promise(function(resolve) { resolve(modulePath); });
  }

  return new Promise(function(resolve) {
    // 清理旧版本
    try {
      var oldFiles = fm.listContents(moduleDir);
      oldFiles.forEach(function(f) { fm.remove(fm.joinPath(moduleDir, f)); });
    } catch(e) {}

    // 下载最新版
    var req = new Request(SCRIPT_URL);
    req.loadString().then(function(content) {
      if (content && content.length > 100) {
        fm.write(modulePath, content);
        resolve(modulePath);
      } else {
        // 下载失败，找旧版本
        resolve(null);
      }
    }).catch(function() {
      resolve(null);
    });
  });
}

// ========== 工具函数 ==========
function pad2(n) {
  var s = String(n);
  return s.length < 2 ? '0' + s : s;
}

function todayStr() {
  var d = new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function monthStartStr() {
  var d = new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-01';
}

function fmtNum(n) {
  if (n === null || n === undefined || n !== n) return '—';
  n = Number(n);
  if (n !== n) return '—';
  if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function safeGetKeychain(key) {
  try { return Keychain.contains(key) ? Keychain.get(key) : null; } catch(e) { return null; }
}
function safeSetKeychain(key, val) {
  try { Keychain.set(key, val); return true; } catch(e) { return false; }
}
function safeRemoveKeychain(key) {
  try { Keychain.remove(key); } catch(e) {}
}

// ========== 服务商配置 ==========
var PROVIDERS = [
  { id:'deepseek',   name:'DeepSeek',   icon:'🧠', color:'#4361EE', unit:'CNY',
    apiKeyHint:'sk-...', keyExample:'sk-abc123...' },
  { id:'openai',      name:'OpenAI',      icon:'🤖', color:'#10A37F', unit:'USD',
    apiKeyHint:'sk-...', keyExample:'sk-abc123...' },
  { id:'anthropic',   name:'Anthropic',   icon:'🟠', color:'#D4A574', unit:'USD',
    apiKeyHint:'sk-ant-...', keyExample:'sk-ant-abc123...' },
  { id:'aliyun',      name:'阿里云百炼', icon:'🔵', color:'#FF6A00', unit:'CNY',
    apiKeyHint:'sk-...', keyExample:'sk-abc123...' },
  { id:'tencent',     name:'腾讯混元',    icon:'🟢', color:'#07C160', unit:'CNY',
    apiKeyHint:'SecretId::SecretKey', keyExample:'AKIDxxx::yourKey',
    note:'格式：SecretId::SecretKey（双冒号分隔）' },
  { id:'moonshot',    name:'Kimi',        icon:'🌙', color:'#7B61FF', unit:'CNY',
    apiKeyHint:'sk-...', keyExample:'sk-abc123...' },
  { id:'zhipu',       name:'智谱 GLM',    icon:'🔷', color:'#5B8FF9', unit:'CNY',
    apiKeyHint:'Bearer', keyExample:'Bearer xxx...' },
  { id:'custom',      name:'自定义端点',   icon:'⚙️', color:'#8E8E93', unit:'USD',
    apiKeyHint:'API Key', keyExample:'Bearer xxx 或 sk-...',
    note:'需同时填写 Base URL（含/v1）' }
];

// ========== 获取已配置的服务商 ID 列表 ==========
function getConfiguredIds() {
  var raw = safeGetKeychain('api_bal_viewer_configured_ids');
  if (!raw) return [];
  try { return JSON.parse(raw); } catch(e) { return []; }
}

function saveConfiguredIds(ids) {
  safeSetKeychain('api_bal_viewer_configured_ids', JSON.stringify(ids));
}

// ========== 获取阈值配置 ==========
function getThresholds() {
  var raw = safeGetKeychain('api_bal_viewer_thresholds');
  if (!raw) return { _global: 5 };
  try { return JSON.parse(raw); } catch(e) { return { _global: 5 }; }
}

function saveThresholds(th) {
  safeSetKeychain('api_bal_viewer_thresholds', JSON.stringify(th));
}

// ========== 腾讯云签名（用于腾讯混元） ==========
function tcSha256Hex(message) {
  // 使用 crypto.subtle.digest 做 SHA256
  // 返回 hex 字符串（同步模拟，实际需 await，这里用简化版）
  // Scriptable 的 Request 支持直接传签名，此处省略完整实现
  // 实际使用在 fetchBalance/fetchUsage 里直接调 HTTP
  return '';
}

// ========== 查询余额 ==========
function fetchBalance(provider, apiKey) {
  return new Promise(function(resolve) {
    var url = '';
    var headers = {};
    var body = null;
    var method = 'GET';

    try {
      if (provider.id === 'deepseek') {
        url = 'https://api.deepseek.com/user/balance';
        headers = { 'Authorization': 'Bearer ' + apiKey };

      } else if (provider.id === 'openai') {
        url = 'https://api.openai.com/dashboard/billing/credit_grants';
        headers = { 'Authorization': 'Bearer ' + apiKey };

      } else if (provider.id === 'anthropic') {
        // Anthropic 无余额接口，返回 null 让上层用 usage 代替
        resolve({ success: false, error: 'no_balance_api' });
        return;

      } else if (provider.id === 'aliyun') {
        url = 'https://dashscope.aliyuncs.com/api/v1/billing/balance';
        headers = { 'Authorization': 'Bearer ' + apiKey };

      } else if (provider.id === 'tencent') {
        // 腾讯混元：用 TC3 签名调计费接口
        // 简化：直接返回 null（实际应通过 HTTP 请求）
        resolve({ success: false, error: 'tencent_need_signature' });
        return;

      } else if (provider.id === 'moonshot') {
        url = 'https://api.moonshot.cn/v1/billing/balance';
        headers = { 'Authorization': 'Bearer ' + apiKey };

      } else if (provider.id === 'zhipu') {
        url = 'https://open.bigmodel.cn/api/paas/v4/billing/subscription';
        headers = { 'Authorization': apiKey };

      } else if (provider.id === 'custom') {
        var baseUrl = safeGetKeychain('api_bal_viewer_custom_url') || '';
        if (!baseUrl) { resolve({ success: false, error: '未配置 Base URL' }); return; }
        url = baseUrl.replace(/\/$/, '') + '/billing/balance';
        headers = { 'Authorization': 'Bearer ' + apiKey };
      }

      if (!url) { resolve({ success: false, error: '未知服务商' }); return; }

      var req = new Request(url);
      req.method = method;
      for (var h in headers) { req.headers[h] = headers[h]; }
      if (body) { req.body = JSON.stringify(body); req.headers['Content-Type'] = 'application/json'; }

      req.loadJSON().then(function(json) {
        // 解析余额（各平台格式不同）
        var balance = null;
        var avail = null;
        try {
          if (provider.id === 'deepseek') {
            balance = json.total_balance;
            avail = json.total_available;
          } else if (provider.id === 'openai') {
            balance = json.total_available;
          } else if (provider.id === 'aliyun') {
            balance = json.balance;
          } else if (provider.id === 'moonshot') {
            balance = json.data && json.data.balance;
          } else if (provider.id === 'zhipu') {
            balance = json.balance;
          } else if (provider.id === 'custom') {
            balance = (json.data && json.data.balance) || json.balance;
          }
        } catch(ex) {}

        if (balance !== null && balance !== undefined) {
          resolve({ success: true, balance: String(balance), available: avail !== null ? String(avail) : null });
        } else {
          resolve({ success: false, error: '无法解析余额数据', raw: json });
        }
      }).catch(function(err) {
        resolve({ success: false, error: String(err) });
      });
    } catch(e) {
      resolve({ success: false, error: String(e) });
    }
  });
}

// ========== 查询用量 ==========
function fetchUsage(provider, apiKey) {
  var today = todayStr();
  var monthStart = monthStartStr();

  return new Promise(function(resolve) {
    var todayTokens = null;
    var monthTokens = null;
    var todayDetail = '';
    var monthDetail = '';

    try {
      // DeepSeek 用量
      if (provider.id === 'deepseek') {
        var url = 'https://api.deepseek.com/user/usage?start_date=' + monthStart + '&end_date=' + today;
        var req = new Request(url);
        req.headers = { 'Authorization': 'Bearer ' + apiKey };
        req.loadJSON().then(function(json) {
          if (json && json.data) {
            var tTokens = 0, tIn = 0, tOut = 0;
            var mTokens = 0, mIn = 0, mOut = 0;
            json.data.forEach(function(d) {
              var dTokens = (d.input_tokens || 0) + (d.output_tokens || 0);
              if (d.date === today) { tTokens += dTokens; tIn += (d.input_tokens || 0); tOut += (d.output_tokens || 0); }
              mTokens += dTokens; mIn += (d.input_tokens || 0); mOut += (d.output_tokens || 0);
            });
            todayTokens = tTokens;
            monthTokens = mTokens;
            todayDetail = '输入 ' + fmtNum(tIn) + ' / 输出 ' + fmtNum(tOut);
            monthDetail = '输入 ' + fmtNum(mIn) + ' / 输出 ' + fmtNum(mOut);
          }
          resolve({ todayTokens: todayTokens, monthTokens: monthTokens, todayDetail: todayDetail, monthDetail: monthDetail });
        }).catch(function() {
          resolve({ todayTokens: null, monthTokens: null, todayDetail: '', monthDetail: '' });
        });
        return;
      }

      // OpenAI 用量（花费）
      if (provider.id === 'openai') {
        var url2 = 'https://api.openai.com/dashboard/billing/usage?start_date=' + monthStart + '&end_date=' + today;
        var req2 = new Request(url2);
        req2.headers = { 'Authorization': 'Bearer ' + apiKey };
        req2.loadJSON().then(function(json) {
          var tCost = 0, mCost = 0;
          if (json && json.daily_costs) {
            json.daily_costs.forEach(function(d) {
              var dateStr = d.start_time ? d.start_time.substring(0, 10) : '';
              var cost = 0;
              if (d.cost_data) { for (var k in d.cost_data) { cost += d.cost_data[k]; } }
              mCost += cost;
              if (dateStr === today) tCost += cost;
            });
          }
          todayTokens = Math.round(tCost * 100) / 100;
          monthTokens = Math.round(mCost * 100) / 100;
          todayDetail = '$' + String(todayTokens);
          monthDetail = '$' + String(monthTokens);
          resolve({ todayTokens: todayTokens, monthTokens: monthTokens, todayDetail: todayDetail, monthDetail: monthDetail });
        }).catch(function() {
          resolve({ todayTokens: null, monthTokens: null, todayDetail: '', monthDetail: '' });
        });
        return;
      }

      // Anthropic 用量
      if (provider.id === 'anthropic') {
        var url3 = 'https://api.anthropic.com/v1/messages/usage?start_date=' + monthStart + '&end_date=' + today;
        var req3 = new Request(url3);
        req3.headers = { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
        req3.loadJSON().then(function(json) {
          if (json) {
            todayTokens = (json.today_input_tokens || 0) + (json.today_output_tokens || 0);
            monthTokens = (json.month_input_tokens || 0) + (json.month_output_tokens || 0);
            todayDetail = '输入 ' + fmtNum(json.today_input_tokens || 0) + ' / 输出 ' + fmtNum(json.today_output_tokens || 0);
            monthDetail = '输入 ' + fmtNum(json.month_input_tokens || 0) + ' / 输出 ' + fmtNum(json.month_output_tokens || 0);
          }
          resolve({ todayTokens: todayTokens, monthTokens: monthTokens, todayDetail: todayDetail, monthDetail: monthDetail });
        }).catch(function() {
          resolve({ todayTokens: null, monthTokens: null, todayDetail: '', monthDetail: '' });
        });
        return;
      }

      // 阿里云百炼用量
      if (provider.id === 'aliyun') {
        var url4 = 'https://dashscope.aliyuncs.com/api/v1/billing/usage?start_date=' + monthStart + '&end_date=' + today;
        var req4 = new Request(url4);
        req4.headers = { 'Authorization': 'Bearer ' + apiKey };
        req4.loadJSON().then(function(json) {
          if (json && json.data) {
            json.data.forEach(function(d) {
              var tokens = (d.input_tokens || 0) + (d.output_tokens || 0);
              if (d.date === today) { todayTokens += tokens; }
              monthTokens += tokens;
            });
          }
          resolve({ todayTokens: todayTokens || null, monthTokens: monthTokens || null, todayDetail: todayTokens ? fmtNum(todayTokens) + ' tokens' : '', monthDetail: monthTokens ? fmtNum(monthTokens) + ' tokens' : '' });
        }).catch(function() {
          resolve({ todayTokens: null, monthTokens: null, todayDetail: '', monthDetail: '' });
        });
        return;
      }

      // Kimi 用量
      if (provider.id === 'moonshot') {
        var url5 = 'https://api.moonshot.cn/v1/billing/usage?start_date=' + monthStart + '&end_date=' + today;
        var req5 = new Request(url5);
        req5.headers = { 'Authorization': 'Bearer ' + apiKey };
        req5.loadJSON().then(function(json) {
          if (json && json.data) {
            todayTokens = (json.data.today_tokens || 0);
            monthTokens = (json.data.month_tokens || 0);
            todayDetail = fmtNum(todayTokens) + ' tokens';
            monthDetail = fmtNum(monthTokens) + ' tokens';
          }
          resolve({ todayTokens: todayTokens || null, monthTokens: monthTokens || null, todayDetail: todayDetail, monthDetail: monthDetail });
        }).catch(function() {
          resolve({ todayTokens: null, monthTokens: null, todayDetail: '', monthDetail: '' });
        });
        return;
      }

      // 智谱 GLM 用量
      if (provider.id === 'zhipu') {
        var url6 = 'https://open.bigmodel.cn/api/paas/v4/billing/usage';
        var req6 = new Request(url6);
        req6.headers = { 'Authorization': apiKey };
        req6.loadJSON().then(function(json) {
          if (json) {
            todayTokens = json.today_tokens || null;
            monthTokens = json.month_tokens || null;
            todayDetail = todayTokens ? fmtNum(todayTokens) + ' tokens' : '';
            monthDetail = monthTokens ? fmtNum(monthTokens) + ' tokens' : '';
          }
          resolve({ todayTokens: todayTokens, monthTokens: monthTokens, todayDetail: todayDetail, monthDetail: monthDetail });
        }).catch(function() {
          resolve({ todayTokens: null, monthTokens: null, todayDetail: '', monthDetail: '' });
        });
        return;
      }

      // 自定义端点用量
      if (provider.id === 'custom') {
        var baseUrl = safeGetKeychain('api_bal_viewer_custom_url') || '';
        if (baseUrl) {
          var url7 = baseUrl.replace(/\/$/, '') + '/billing/usage';
          var req7 = new Request(url7);
          req7.headers = { 'Authorization': 'Bearer ' + apiKey };
          req7.loadJSON().then(function(json) {
            if (json) {
              todayTokens = json.today_tokens || json.data && json.data.today_tokens || null;
              monthTokens = json.month_tokens || json.data && json.data.month_tokens || null;
              todayDetail = todayTokens ? fmtNum(todayTokens) : '';
              monthDetail = monthTokens ? fmtNum(monthTokens) : '';
            }
            resolve({ todayTokens: todayTokens, monthTokens: monthTokens, todayDetail: todayDetail, monthDetail: monthDetail });
          }).catch(function() {
            resolve({ todayTokens: null, monthTokens: null, todayDetail: '', monthDetail: '' });
          });
          return;
        }
      }

      // 腾讯混元：暂无用量接口
      if (provider.id === 'tencent') {
        resolve({ todayTokens: null, monthTokens: null, todayDetail: '用量接口待支持', monthDetail: '' });
        return;
      }

      resolve({ todayTokens: null, monthTokens: null, todayDetail: '', monthDetail: '' });
    } catch(e) {
      resolve({ todayTokens: null, monthTokens: null, todayDetail: '', monthDetail: '', error: String(e) });
    }
  });
}

// ========== 并发查询所有服务商 ==========
function fetchAll() {
  return new Promise(function(resolve) {
    var ids = getConfiguredIds();
    if (ids.length === 0) { resolve([]); return; }

    var promises = ids.map(function(id) {
      return new Promise(function(pResolve) {
        var prov = null;
        for (var i = 0; i < PROVIDERS.length; i++) {
          if (PROVIDERS[i].id === id) { prov = PROVIDERS[i]; break; }
        }
        if (!prov) { pResolve(null); return; }

        var apiKey = safeGetKeychain('api_bal_viewer_' + id);
        if (!apiKey) { pResolve(null); return; }

        // 先查余额
        fetchBalance(prov, apiKey).then(function(balResult) {
          // 再查用量
          fetchUsage(prov, apiKey).then(function(usageResult) {
            var result = {
              id: id,
              provider: prov,
              success: balResult.success,
              balance: balResult.balance || null,
              available: balResult.available || null,
              unit: prov.unit,
              error: balResult.error || null,
              todayTokens: usageResult.todayTokens,
              monthTokens: usageResult.monthTokens,
              todayDetail: usageResult.todayDetail,
              monthDetail: usageResult.monthDetail
            };
            pResolve(result);
          }).catch(function() {
            pResolve({ id: id, provider: prov, success: balResult.success, balance: null, error: '用量查询失败' });
          });
        }).catch(function() {
          pResolve({ id: id, provider: prov, success: false, balance: null, error: '查询失败' });
        });
      });
    });

    Promise.all(promises).then(function(results) {
      resolve(results.filter(function(r) { return r !== null; }));
    });
  });
}

// ========== 检查阈值并推送通知 ==========
function checkThresholds(results) {
  var th = getThresholds();
  results.forEach(function(r) {
    if (!r.success || !r.balance) return;
    var balNum = parseFloat(r.balance);
    if (balNum !== balNum) return;
    var threshold = th[r.id] || th['_global'] || 5;
    if (balNum <= threshold) {
      var n = new Notification();
      n.title = '⚠️ ' + r.provider.name + ' 余额不足';
      n.body = '当前余额: ' + r.balance + ' ' + r.unit + '（阈值: ' + threshold + '）';
      n.schedule();
    }
  });
}

// ========== 显示主界面（UITable）==========
function showDashboard(results) {
  return new Promise(function(resolve) {
    var table = new UITable();
    table.name = 'API 余额查看器';

    // 标题行
    var headerRow = new UITableRow();
    headerRow.addText(function(cell) {
      cell.title = '📊 API 余额查看器';
      cell.titleColor = new Color('#1C1C1E');
      cell.titleFont = Font.boldSystemFont(18);
    });
    table.addRow(headerRow);

    // 更新时间行
    var now = new Date();
    var timeStr = pad2(now.getHours()) + ':' + pad2(now.getMinutes()) + ':' + pad2(now.getSeconds());
    var timeRow = new UITableRow();
    timeRow.addText(function(cell) {
      cell.title = '🕐 更新于 ' + timeStr;
      cell.titleColor = Color.gray();
      cell.titleFont = Font.systemFont(12);
    });
    table.addRow(timeRow);

    // 分隔行
    var sepRow = new UITableRow();
    sepRow.addSpacer(10);
    table.addRow(sepRow);

    if (results.length === 0) {
      var emptyRow = new UITableRow();
      emptyRow.addText(function(cell) {
        cell.title = '暂无配置的服务商';
        cell.subtitle = '请点击「配置」添加';
        cell.titleColor = Color.gray();
      });
      table.addRow(emptyRow);
    } else {
      // 计算总余额（CNY 和 USD 分开）
      var totalCNY = 0, hasCNY = false;
      var totalUSD = 0, hasUSD = false;

      results.forEach(function(r) {
        if (!r.success || !r.balance) return;
        var b = parseFloat(r.balance);
        if (isNaN(b)) return;
        if (r.unit === 'CNY') { totalCNY += b; hasCNY = true; }
        if (r.unit === 'USD') { totalUSD += b; hasUSD = true; }
      });

      // 总计行
      if (hasCNY || hasUSD) {
        var totalRow = new UITableRow();
        totalRow.addText(function(cell) {
          var txt = '合计: ';
          if (hasCNY) txt += '¥' + totalCNY.toFixed(2);
          if (hasCNY && hasUSD) txt += ' / ';
          if (hasUSD) txt += '$' + totalUSD.toFixed(2);
          cell.title = txt;
          cell.titleColor = new Color('#4361EE');
          cell.titleFont = Font.boldSystemFont(16);
        });
        table.addRow(totalRow);

        var sep2 = new UITableRow();
        sep2.addSpacer(10);
        table.addRow(sep2);
      }

      // 每个服务商一行
      results.forEach(function(r) {
        var row = new UITableRow();

        // 图标 + 名称
        var titleStr = r.provider.icon + ' ' + r.provider.name;
        var subtitleStr = '';

        if (r.success && r.balance) {
          var balNum = parseFloat(r.balance);
          var isLow = false;
          var th = getThresholds();
          var threshold = th[r.id] || th['_global'] || 5;
          if (!isNaN(balNum) && balNum <= threshold) isLow = true;

          subtitleStr = (r.unit === 'CNY' ? '¥' : '$') + r.balance;
          if (r.available) subtitleStr += '（可用 ¥' + r.available + '）';
          if (isLow) { subtitleStr = '⚠️ ' + subtitleStr + ' 余额低'; }
        } else if (r.error === 'no_balance_api') {
          subtitleStr = '（无余额接口，显示用量）';
        } else if (r.error) {
          subtitleStr = '❌ ' + r.error.substring(0, 30);
        }

        // 今日/本月用量（如果有）
        var usageStr = '';
        if (r.todayTokens !== null && r.todayTokens !== undefined) {
          usageStr = '📅今日: ' + fmtNum(r.todayTokens);
        }
        if (r.monthTokens !== null && r.monthTokens !== undefined) {
          if (usageStr) usageStr += '  ';
          usageStr += '📆本月: ' + fmtNum(r.monthTokens);
        }
        if (usageStr) {
          subtitleStr += '\n' + usageStr;
        }

        row.addText(function(cell) {
          cell.title = titleStr;
          cell.subtitle = subtitleStr;
          if (r.success) {
            cell.titleColor = new Color(r.provider.color);
          } else {
            cell.titleColor = Color.red();
          }
          cell.titleFont = Font.boldSystemFont(14);
          cell.subtitleFont = Font.systemFont(11);
          cell.subtitleColor = Color.gray();
        });

        // 点击行 → 刷新该服务商
        row.onTap = function() {
          // 刷新单个服务商
          refreshSingle(r.id);
        };

        table.addRow(row);
      });
    }

    // 操作按钮行
    var sep3 = new UITableRow();
    sep3.addSpacer(10);
    table.addRow(sep3);

    var refreshRow = new UITableRow();
    refreshRow.addButton(function(cell) {
      cell.title = '🔄 刷新全部';
    });
    refreshRow.onTap = function() {
      mainMenu(); // 回到主菜单重新查询
    };
    table.addRow(refreshRow);

    var configRow = new UITableRow();
    configRow.addButton(function(cell) {
      cell.title = '⚙️ 配置服务商';
    });
    configRow.onTap = function() {
      showConfigMenu();
    };
    table.addRow(configRow);

    var notifyRow = new UITableRow();
    notifyRow.addButton(function(cell) {
      cell.title = '🔔 测试通知';
    });
    notifyRow.onTap = function() {
      testNotification();
    };
    table.addRow(notifyRow);

    // 展示表格
    table.present().then(function() {
      resolve();
    }).catch(function() {
      resolve();
    });
  });
}

// ========== 刷新单个服务商 ==========
function refreshSingle(id) {
  var prov = null;
  for (var i = 0; i < PROVIDERS.length; i++) {
    if (PROVIDERS[i].id === id) { prov = PROVIDERS[i]; break; }
  }
  if (!prov) return;

  var apiKey = safeGetKeychain('api_bal_viewer_' + id);
  if (!apiKey) return;

  // 显示加载提示
  var alert = new Alert();
  alert.title = '查询中...';
  alert.message = '正在查询 ' + prov.name + ' 余额...';
  alert.presentAlert();

  fetchBalance(prov, apiKey).then(function(balResult) {
    fetchUsage(prov, apiKey).then(function(usageResult) {
      var result = {
        id: id, provider: prov, success: balResult.success,
        balance: balResult.balance || null, unit: prov.unit,
        error: balResult.error || null,
        todayTokens: usageResult.todayTokens,
        monthTokens: usageResult.monthTokens,
        todayDetail: usageResult.todayDetail,
        monthDetail: usageResult.monthDetail
      };
      // 显示结果
      showSingleResult(result);
    });
  });
}

function showSingleResult(result) {
  var alert = new Alert();
  if (result.success) {
    alert.title = result.provider.icon + ' ' + result.provider.name;
    var msg = '余额: ' + (result.unit === 'CNY' ? '¥' : '$') + result.balance + '\n';
    if (result.available) msg += '可用: ' + result.available + '\n';
    if (result.todayTokens !== null) msg += '\n📅 今日用量: ' + fmtNum(result.todayTokens) + '\n' + result.todayDetail;
    if (result.monthTokens !== null) msg += '\n📆 本月用量: ' + fmtNum(result.monthTokens) + '\n' + result.monthDetail;
    alert.message = msg;
  } else {
    alert.title = '❌ ' + result.provider.name;
    alert.message = '查询失败: ' + (result.error || '未知错误');
  }
  alert.addAction('确定');
  alert.presentAlert();
}

// ========== 配置菜单 ==========
function showConfigMenu() {
  var alert = new Alert();
  alert.title = '⚙️ 配置服务商';
  alert.message = '选择操作';

  var ids = getConfiguredIds();

  // 添加服务商
  alert.addAction('➕ 添加服务商');
  // 编辑/删除已配置的
  ids.forEach(function(id) {
    var prov = null;
    for (var i = 0; i < PROVIDERS.length; i++) {
      if (PROVIDERS[i].id === id) { prov = PROVIDERS[i]; break; }
    }
    if (prov) alert.addAction('✏️ ' + prov.name);
  });
  // 全局设置
  alert.addAction('🌍 全局设置');
  alert.addCancelAction('返回');

  alert.presentSheet().then(function(idx) {
    if (idx === -1) { mainMenu(); return; }

    var actions = [];
    actions.push('add');
    ids.forEach(function(id) { actions.push(id); });
    actions.push('global');

    var action = actions[idx];
    if (action === 'add') {
      showAddProviderMenu();
    } else if (action === 'global') {
      showGlobalSettings();
    } else {
      showEditProvider(action);
    }
  });
}

function showAddProviderMenu() {
  var alert = new Alert();
  alert.title = '选择服务商';
  alert.message = '选择要添加的服务商';

  var ids = getConfiguredIds();
  var available = PROVIDERS.filter(function(p) { return ids.indexOf(p.id) === -1; });

  if (available.length === 0) {
    var a = new Alert();
    a.title = '提示';
    a.message = '所有服务商已配置';
    a.addAction('确定');
    a.presentAlert();
    showConfigMenu();
    return;
  }

  available.forEach(function(p) {
    alert.addAction(p.icon + ' ' + p.name);
  });
  alert.addCancelAction('返回');

  alert.presentSheet().then(function(idx) {
    if (idx === -1) { showConfigMenu(); return; }
    var prov = available[idx];
    showProviderForm(prov, true);
  });
}

function showProviderForm(prov, isNew) {
  var alert = new Alert();
  alert.title = (isNew ? '➕ 添加 ' : '✏️ 编辑 ') + prov.name;
  if (prov.note) {
    alert.message = prov.note + '\n\nAPI Key:';
  } else {
    alert.message = 'API Key:';
  }
  alert.addTextField(prov.apiKeyHint, safeGetKeychain('api_bal_viewer_' + prov.id) || '');

  if (prov.id === 'custom') {
    alert.message += '\n\nBase URL（含 /v1）:';
    alert.addTextField('https://...', safeGetKeychain('api_bal_viewer_custom_url') || '');
  }

  alert.message += '\n\n预警阈值（余额低于此值通知）:';
  var th = getThresholds();
  var curTh = th[prov.id] || th['_global'] || 5;
  alert.addTextField('阈值（数字）', String(curTh));

  if (isNew) {
    alert.addAction('保存');
  } else {
    alert.addAction('保存');
    alert.addDestructiveAction('删除此服务商');
  }
  alert.addCancelAction('取消');

  alert.presentAlert().then(function(idx) {
    if (idx === -1) { showConfigMenu(); return; }

    if (idx === 1 && !isNew) {
      // 删除
      var ids = getConfiguredIds();
      ids = ids.filter(function(x) { return x !== prov.id; });
      saveConfiguredIds(ids);
      safeRemoveKeychain('api_bal_viewer_' + prov.id);
      showConfigMenu();
      return;
    }

    var apiKey = alert.textFieldValue(0);
    if (!apiKey || apiKey.trim() === '') {
      var err = new Alert();
      err.title = '错误';
      err.message = 'API Key 不能为空';
      err.addAction('确定');
      err.presentAlert();
      showConfigMenu();
      return;
    }

    safeSetKeychain('api_bal_viewer_' + prov.id, apiKey.trim());

    if (prov.id === 'custom') {
      var baseUrl = alert.textFieldValue(1);
      if (baseUrl) safeSetKeychain('api_bal_viewer_custom_url', baseUrl.trim());
    }

    // 保存阈值
    var thVal = parseFloat(alert.textFieldValue(prov.id === 'custom' ? 2 : 1));
    if (!isNaN(thVal)) {
      th[prov.id] = thVal;
      saveThresholds(th);
    }

    // 添加到已配置列表
    var ids2 = getConfiguredIds();
    if (ids2.indexOf(prov.id) === -1) {
      ids2.push(prov.id);
      saveConfiguredIds(ids2);
    }

    var success = new Alert();
    success.title = '✅ 保存成功';
    success.message = prov.name + ' 已保存';
    success.addAction('确定');
    success.presentAlert().then(function() {
      showConfigMenu();
    });
  });
}

function showEditProvider(id) {
  var prov = null;
  for (var i = 0; i < PROVIDERS.length; i++) {
    if (PROVIDERS[i].id === id) { prov = PROVIDERS[i]; break; }
  }
  if (prov) showProviderForm(prov, false);
}

function showGlobalSettings() {
  var th = getThresholds();
  var alert = new Alert();
  alert.title = '🌍 全局设置';
  alert.message = '全局预警阈值（适用于所有未单独设置阈值的服务商）:\n\n当前: ' + (th['_global'] || 5);
  alert.addTextField('全局阈值（数字）', String(th['_global'] || 5));
  alert.addAction('保存');
  alert.addCancelAction('返回');

  alert.presentAlert().then(function(idx) {
    if (idx === -1) { showConfigMenu(); return; }
    var val = parseFloat(alert.textFieldValue(0));
    if (!isNaN(val)) {
      th['_global'] = val;
      saveThresholds(th);
      var a = new Alert();
      a.title = '✅ 已保存';
      a.message = '全局阈值: ' + val;
      a.addAction('确定');
      a.presentAlert().then(function() { showConfigMenu(); });
    } else {
      showConfigMenu();
    }
  });
}

// ========== 测试通知 ==========
function testNotification() {
  var n = new Notification();
  n.title = '🔔 API余额查看器';
  n.body = '通知功能正常！当余额低于阈值时会收到此通知。';
  n.schedule();

  var a = new Alert();
  a.title = '✅ 通知已发送';
  a.message = '请检查 iPhone 通知中心';
  a.addAction('确定');
  a.presentAlert();
}

// ========== Widget 小组件 ==========
function buildWidget(results) {
  var w = new ListWidget();
  w.setPadding(12, 14, 12, 14);

  var th = getThresholds();
  var hasLow = false;

  // 背景色
  results.forEach(function(r) {
    if (!r.success || !r.balance) return;
    var balNum = parseFloat(r.balance);
    if (balNum !== balNum) return;
    var threshold = th[r.id] || th['_global'] || 5;
    if (balNum <= threshold) hasLow = true;
  });
  if (hasLow) {
    w.backgroundColor = new Color('#FFF0F0');
  } else {
    w.backgroundColor = new Color('#F2F2F7');
  }

  // 标题
  var titleTxt = w.addText('API 余额');
  titleTxt.font = Font.boldSystemFont(13);
  titleTxt.textColor = new Color('#8E8E93');

  w.addSpacer(6);

  if (results.length === 0) {
    var noTxt = w.addText('暂无数据\n点击配置服务商');
    noTxt.font = Font.systemFont(11);
    noTxt.textColor = Color.gray();
    return w;
  }

  // 根据尺寸显示不同内容
  var family = config && config.widgetFamily ? config.widgetFamily : 'medium';

  results.forEach(function(r) {
    if (family === 'small' && r.provider.id !== results[0].provider.id) return; // small 只显示第一个

    var row = w.addStack();
    row.layoutHorizontally();

    var nameTxt = row.addText(r.provider.icon + ' ' + r.provider.name);
    nameTxt.font = Font.systemFont(11);
    nameTxt.textColor = new Color(r.provider.color);

    row.addSpacer();

    if (r.success && r.balance) {
      var balNum = parseFloat(r.balance);
      var isLow = false;
      var threshold = th[r.id] || th['_global'] || 5;
      if (!isNaN(balNum) && balNum <= threshold) isLow = true;

      var balTxt = row.addText((r.unit === 'CNY' ? '¥' : '$') + r.balance);
      balTxt.font = Font.boldSystemFont(12);
      balTxt.textColor = isLow ? Color.red() : new Color('#1C1C1E');
    } else {
      var errTxt = row.addText('异常');
      errTxt.font = Font.systemFont(11);
      errTxt.textColor = Color.red();
    }

    w.addSpacer(4);
  });

  // Medium/Large：显示用量
  if (family !== 'small') {
    results.forEach(function(r) {
      if (r.todayTokens !== null) {
        var uRow = w.addStack();
        uRow.layoutHorizontally();
        var uTxt = uRow.addText('📅' + r.provider.name.substring(0, 4) + ' 今日: ' + fmtNum(r.todayTokens));
        uTxt.font = Font.systemFont(10);
        uTxt.textColor = Color.gray();
        w.addSpacer(2);
      }
    });
  }

  // Large：显示本月用量
  if (family === 'large') {
    w.addSpacer(6);
    var sep = w.addText('―――――――――――');
    sep.font = Font.systemFont(10);
    sep.textColor = new Color('#E5E5EA');
    w.addSpacer(4);

    results.forEach(function(r) {
      if (r.monthTokens !== null) {
        var mRow = w.addStack();
        mRow.layoutHorizontally();
        var mTxt = mRow.addText('📆 ' + r.provider.name + ' 本月: ' + fmtNum(r.monthTokens));
        mTxt.font = Font.systemFont(10);
        mTxt.textColor = Color.gray();
        w.addSpacer(2);
      }
    });
  }

  w.addSpacer(4);
  var now = new Date();
  var timeTxt = w.addText(pad2(now.getHours()) + ':' + pad2(now.getMinutes()) + ' 更新');
  timeTxt.font = Font.systemFont(10);
  timeTxt.textColor = new Color('#AEAEB2');

  return w;
}

// ========== 带超时的 fetchAll ==========
function fetchAllWithTimeout(timeoutMs) {
  return new Promise(function(resolve) {
    var done = false;
    var timer = setTimeout(function() {
      if (!done) { done = true; resolve({ timedOut: true, results: [] }); }
    }, timeoutMs);

    fetchAll().then(function(results) {
      if (!done) { done = true; clearTimeout(timer); resolve({ timedOut: false, results: results }); }
    }).catch(function(err) {
      if (!done) { done = true; clearTimeout(timer); resolve({ timedOut: false, results: [], error: String(err) }); }
    });
  });
}

// ========== 主入口 ==========
function mainMenu() {
  // 直接查询（不弹loading alert，避免UI阻塞）
  fetchAllWithTimeout(15000).then(function(res) {
    if (res.timedOut) {
      var a = new Alert();
      a.title = '⏱ 查询超时';
      a.message = '网络请求超时（15秒），请检查网络连接后重试';
      a.addAction('重试');
      a.addCancelAction('退出');
      a.presentAlert().then(function(idx) {
        if (idx === 0) mainMenu();
      });
      return;
    }
    if (res.error) {
      var a = new Alert();
      a.title = '❌ 查询出错';
      a.message = res.error;
      a.addAction('重试');
      a.addCancelAction('退出');
      a.presentAlert().then(function(idx) {
        if (idx === 0) mainMenu();
      });
      return;
    }
    checkThresholds(res.results);
    showDashboard(res.results);
  });
}

// ========== 脚本入口（自动更新加载器）==========
(async function() {
  var modulePath = await downloadModule();
  if (modulePath) {
    try {
      var module = await importModule(modulePath);
      if (module && module.main) {
        await module.main();
        return;
      }
    } catch(e) {
      console.log("模块加载失败，使用内嵌版本: " + e);
    }
  }
  // 如果远程加载失败，使用内嵌的主逻辑
  runMain();
})();

// ========== 内嵌主逻辑（离线备用） ==========
function runMain() {
  // Widget 模式
  if (config && config.widgetFamily) {
    fetchAll().then(function(results) {
      var w = buildWidget(results);
      Script.setWidget(w);
      Script.complete();
    }).catch(function() {
      var w = new ListWidget();
      w.addText("加载失败").textColor = Color.red();
      Script.setWidget(w);
      Script.complete();
    });
    return;
  }

  // Siri 静默模式
  if (args && args.widgetParameter === "silent") {
    fetchAll().then(function(results) {
      checkThresholds(results);
      Script.complete();
    }).catch(function() {
      Script.complete();
    });
    return;
  }

  // 正常 App 模式
  var ids = getConfiguredIds();
  if (ids.length === 0) {
    var welcome = new Alert();
    welcome.title = "API 余额查看器 v6.0";
    welcome.message = "欢迎使用！\n\n请先配置要查询的服务商（DeepSeek/OpenAI/阿里云等）";
    welcome.addAction("开始配置");
    welcome.addCancelAction("退出");
    welcome.presentAlert().then(function(idx) {
      if (idx === 0) showConfigMenu();
    });
  } else {
    mainMenu();
  }
}
