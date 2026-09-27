// 우편번호 검색 (카카오/다음 우편번호 서비스, 무료·키 불필요)
//  - 처음 누를 때 스크립트를 불러오고, 불러오지 못하면 직접 입력하도록 안내합니다.
const SRC = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
let loading = null;

function load() {
  if (window.daum?.Postcode) return Promise.resolve();
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SRC;
      s.async = true;
      s.onload = resolve;
      s.onerror = () => {
        loading = null;
        reject(new Error('우편번호 검색을 불러오지 못했습니다. 주소를 직접 입력해 주세요.'));
      };
      document.head.appendChild(s);
    });
  }
  return loading;
}

// 선택 시 onSelect({ zipcode, address }) 호출
export async function openPostcode(onSelect) {
  await load();
  new window.daum.Postcode({
    oncomplete: (d) => {
      const extra = [d.bname, d.buildingName].filter(Boolean).join(', ');
      const road = d.roadAddress || d.address;
      onSelect({ zipcode: d.zonecode, address: extra && d.roadAddress ? `${road} (${extra})` : road });
    },
  }).open();
}
