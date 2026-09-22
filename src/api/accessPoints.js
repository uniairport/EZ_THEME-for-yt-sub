import request from './request';

export function fetchAccessPointSettings() {
  return request({
    url: '/node-access-points',
    method: 'get',
    headers: {
      'Cache-Control': 'no-cache'
    }
  });
}

export function saveAccessPointSelections(selections) {
  return request({
    url: '/node-access-points/selections',
    method: 'post',
    data: {
      // XBoard 模式会把 POST 数据转换为表单，使用 JSON 字符串可完整保留数组结构。
      selections: JSON.stringify(selections)
    }
  });
}
