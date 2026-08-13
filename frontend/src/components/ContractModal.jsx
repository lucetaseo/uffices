import React, { useState } from 'react';

// DB에 저장되어 있는 담당 상담사 샘플 목록
const initialCounselorList = [
  { id: 1, name: '김상담', phone: '010-1111-2222', code: 'CS-01' },
  { id: 2, name: '박플래너', phone: '010-3333-4444', code: 'CS-02' },
  { id: 3, name: '이실장', phone: '010-5555-6666', code: 'CS-03' },
  { id: 4, name: '최팀장', phone: '010-7777-8888', code: 'CS-04' }
];

export default function ContractModal({ isOpen, onClose, onSubmit }) {
  if (!isOpen) return null;

  // 상담사 검색 모달 상태
  const [counselorSearchTerm, setCounselorSearchTerm] = useState('');
  const [isCounselorSearchOpen, setIsCounselorSearchOpen] = useState(false);

  // 메인 계약 폼 상태
  const [formData, setFormData] = useState({
    brand: '더좋은집',
    receptionType: '음성',
    constructionType: '청소',
    counselorName: '', // 계약 진행 상담사명
    counselorPhone: '', // 상담사 연락처
    customerName: '', // 실계약 고객명
    customerPhone: '', // 고객 연락처
    aptName: '',
    dong: '',
    ho: '',
    contractAmount: '',
    balanceAmount: '',
    contractDate: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // 검색어 필터링 (상담사 이름 또는 연락처)
  const filteredCounselors = initialCounselorList.filter(
    (c) => c.name.includes(counselorSearchTerm) || c.phone.includes(counselorSearchTerm)
  );

  // 검색된 담당 상담사 선택 시 상담사 정보 자동 채우기
  const handleSelectCounselor = (counselor) => {
    setFormData((prev) => ({
      ...prev,
      counselorName: counselor.name,
      counselorPhone: counselor.phone
    }));
    setIsCounselorSearchOpen(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="customer-reg-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-top-bar">
          <h3>&gt; 더좋은집,더스타트 전자계약 등록</h3>
          <button type="button" className="modal-close-x" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="reg-table-form">
          <table className="form-grid-table">
            <tbody>
              {/* 1. 브랜드 선택 */}
              <tr>
                <td className="label-col">브랜드 선택 <span className="star">*</span></td>
                <td className="input-col">
                  <label className="radio-item">
                    <input 
                      type="radio" 
                      name="brand" 
                      value="더좋은집" 
                      checked={formData.brand === '더좋은집'} 
                      onChange={handleChange} 
                    /> 더좋은집
                  </label>
                  <label className="radio-item">
                    <input 
                      type="radio" 
                      name="brand" 
                      value="더스타트" 
                      checked={formData.brand === '더스타트'} 
                      onChange={handleChange} 
                    /> 더스타트
                  </label>
                </td>
              </tr>

              {/* 2. 접수 / 시공구분 */}
              <tr>
                <td className="label-col">접수 / 시공구분 <span className="star">*</span></td>
                <td className="input-col">
                  <select 
                    name="receptionType" 
                    value={formData.receptionType} 
                    onChange={handleChange} 
                    className="input-text"
                    style={{ marginRight: '10px' }}
                  >
                    <option value="음성">음성접수</option>
                    <option value="박람회">박람회접수</option>
                    <option value="온라인">온라인접수</option>
                  </select>
                  <select 
                    name="constructionType" 
                    value={formData.constructionType} 
                    onChange={handleChange} 
                    className="input-text"
                  >
                    <option value="청소">청소</option>
                    <option value="줄눈">줄눈</option>
                    <option value="나노코팅">나노코팅</option>
                    <option value="탄성">탄성</option>
                  </select>
                </td>
              </tr>

              {/* 3. 계약 진행 상담사 (계약자) 선택 */}
              <tr>
                <td className="label-col">계약자 (상담사) <span className="star">*</span></td>
                <td className="input-col">
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input 
                      type="text" 
                      name="counselorName" 
                      value={formData.counselorName} 
                      onChange={handleChange} 
                      className="input-text name-input" 
                      placeholder="상담사 이름" 
                      required 
                    />
                    <button 
                      type="button" 
                      className="btn-dark-sm"
                      onClick={() => setIsCounselorSearchOpen(true)}
                    >
                      🔍 담당 상담사 검색
                    </button>
                  </div>
                </td>
              </tr>

              {/* 4. 고객 정보 (실계약 고객) */}
              <tr>
                <td className="label-col">고객 정보 <span className="star">*</span></td>
                <td className="input-col">
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="text" 
                      name="customerName" 
                      value={formData.customerName} 
                      onChange={handleChange} 
                      className="input-text" 
                      placeholder="고객 성함" 
                      style={{ width: '130px' }}
                      required 
                    />
                    <input 
                      type="text" 
                      name="customerPhone" 
                      value={formData.customerPhone} 
                      onChange={handleChange} 
                      className="input-text" 
                      placeholder="고객 연락처 (010-0000-0000)" 
                      style={{ width: '200px' }}
                      required 
                    />
                  </div>
                </td>
              </tr>

              {/* 5. 아파트 / 현장주소 */}
              <tr>
                <td className="label-col">아파트 / 현장주소 <span className="star">*</span></td>
                <td className="input-col">
                  <input 
                    type="text" 
                    name="aptName" 
                    value={formData.aptName} 
                    onChange={handleChange} 
                    className="input-text addr-input" 
                    placeholder="아파트명 또는 현장명" 
                    style={{ marginRight: '6px' }}
                    required 
                  />
                  <input 
                    type="text" 
                    name="dong" 
                    value={formData.dong} 
                    onChange={handleChange} 
                    className="input-text" 
                    placeholder="동" 
                    style={{ width: '60px', marginRight: '6px' }} 
                  />
                  <input 
                    type="text" 
                    name="ho" 
                    value={formData.ho} 
                    onChange={handleChange} 
                    className="input-text" 
                    placeholder="호" 
                    style={{ width: '60px' }} 
                  />
                </td>
              </tr>

              {/* 6. 시공예정일 */}
              <tr>
                <td className="label-col">시공예정일</td>
                <td className="input-col">
                  <input 
                    type="text" 
                    name="contractDate" 
                    value={formData.contractDate} 
                    onChange={handleChange} 
                    className="input-text" 
                    placeholder="2026-08-28(14:00)" 
                  />
                </td>
              </tr>

              {/* 7. 계약금 및 잔액 */}
              <tr>
                <td className="label-col">계약금 및 잔액</td>
                <td className="input-col">
                  <input 
                    type="number" 
                    name="contractAmount" 
                    value={formData.contractAmount} 
                    onChange={handleChange} 
                    className="input-text" 
                    placeholder="실계약금" 
                    style={{ width: '120px', marginRight: '6px' }} 
                  /> 원
                  <span style={{ margin: '0 10px' }}>/</span>
                  <input 
                    type="number" 
                    name="balanceAmount" 
                    value={formData.balanceAmount} 
                    onChange={handleChange} 
                    className="input-text" 
                    placeholder="잔액" 
                    style={{ width: '120px', marginRight: '6px' }} 
                  /> 원
                </td>
              </tr>
            </tbody>
          </table>

          <div className="form-bottom-btns">
            <button type="submit" className="btn-dark-lg">계약 등록완료</button>
            <button type="button" className="btn-dark-lg cancel" onClick={onClose}>취소</button>
          </div>
        </form>
      </div>

      {/* 담당 상담사 검색/선택 서브 팝업 */}
      {isCounselorSearchOpen && (
        <div className="modal-overlay" style={{ zIndex: 10000 }} onClick={() => setIsCounselorSearchOpen(false)}>
          <div className="modal-content talk-modal" onClick={(e) => e.stopPropagation()}>
            <h3>🔍 담당 상담사(계약자) 검색 및 선택</h3>
            <input 
              type="text" 
              placeholder="상담사 이름 또는 연락처 검색" 
              value={counselorSearchTerm}
              onChange={(e) => setCounselorSearchTerm(e.target.value)}
              className="input-text"
              style={{ width: '100%', marginBottom: '15px' }}
            />

            <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #dce1e8', borderRadius: '4px' }}>
              {filteredCounselors.length === 0 ? (
                <p style={{ padding: '20px', textAlignment: 'center', color: '#888' }}>일치하는 상담사가 없습니다.</p>
              ) : (
                filteredCounselors.map((counselor) => (
                  <div 
                    key={counselor.id} 
                    style={{ 
                      padding: '10px 12px', 
                      borderBottom: '1px solid #edf0f5', 
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                    onClick={() => handleSelectCounselor(counselor)}
                  >
                    <div>
                      <strong>{counselor.name}</strong> ({counselor.phone})
                      <div style={{ fontSize: '11px', color: '#666' }}>사번/코드: {counselor.code}</div>
                    </div>
                    <button type="button" className="btn-dark-sm">선택</button>
                  </div>
                ))
              )}
            </div>

            <div className="modal-actions" style={{ marginTop: '15px' }}>
              <button className="btn-cancel" onClick={() => setIsCounselorSearchOpen(false)}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}