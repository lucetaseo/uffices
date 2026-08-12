import React, { useState } from 'react';

export default function ContractModal({ isOpen, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    userType: '개인',
    name: '',
    phone1: '',
    phone2: '',
    brand: '더좋은집',
    constructionType: '시공',
    receptionType: '박람회',
    manager: '',
    aptName: '',
    dong: '',
    ho: '',
    type: '',
    pyeong: '',
    contractDate: '',
    moveInDate: '',
    taxInvoice: '미발행',
    taxInvoiceNum: '',
    cashReceipt: '미발행',
    cashReceiptPhone: '',
    totalAmount: '',
    discountAmount: '',
    contractAmount: '',
    balanceAmount: ''
  });

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
    onClose();
  };

  return (
    <div className="contract-modal-overlay" onClick={onClose}>
      <div className="contract-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-bar">
          <h2>전자계약 <span className="sub-title">/ 관리자님(admin)</span></h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-scroll-body">
          <form onSubmit={handleSubmit} className="contract-form">
            <h1 className="form-main-title">더좋은집,더스타트 전자계약</h1>

            <section className="form-section">
              <div className="section-header">
                <h3>계약자등록</h3>
                <span className="required-notice">* 표시항목은 필수등록사항입니다.</span>
              </div>

              <div className="form-row">
                <label className="form-label">유형분류</label>
                <div className="radio-group">
                  <label><input type="radio" name="userType" value="개인" checked={formData.userType === '개인'} onChange={handleChange} /> 개인</label>
                  <label><input type="radio" name="userType" value="기업" checked={formData.userType === '기업'} onChange={handleChange} /> 기업</label>
                </div>
              </div>

              <div className="form-row">
                <label className="form-label">이름 <span className="star">*</span></label>
                <div className="input-with-desc">
                  <input type="text" name="name" value={formData.name} onChange={handleChange} required className="underline-input medium" />
                  <span className="input-desc">① 계약자명은 등록 후 수정이 불가능합니다.</span>
                </div>
              </div>

              <div className="form-row">
                <label className="form-label">연락처 ① <span className="star">*</span></label>
                <div className="input-with-desc">
                  <input type="text" name="phone1" value={formData.phone1} onChange={handleChange} required placeholder="010-0000-0000" className="underline-input medium" />
                  <span className="input-desc">① 이미 등록된 연락처 중 일치하는 경우가 있다면 아래영역에 표시됩니다.</span>
                </div>
              </div>

              <div className="form-row">
                <label className="form-label">연락처 ②</label>
                <div className="input-with-desc">
                  <input type="text" name="phone2" value={formData.phone2} onChange={handleChange} placeholder="010-0000-0000" className="underline-input medium" />
                </div>
              </div>
            </section>

            <section className="form-section">
              <div className="section-header">
                <h3>계약/시공정보등록</h3>
              </div>

              <div className="form-row">
                <label className="form-label">브랜드 <span className="star">*</span></label>
                <div className="radio-group">
                  <label><input type="radio" name="brand" value="더좋은집" checked={formData.brand === '더좋은집'} onChange={handleChange} /> 더좋은집</label>
                  <label><input type="radio" name="brand" value="더스타트" checked={formData.brand === '더스타트'} onChange={handleChange} /> 더스타트</label>
                  <label><input type="radio" name="brand" value="신화홈케어" checked={formData.brand === '신화홈케어'} onChange={handleChange} /> 신화홈케어</label>
                </div>
              </div>

              <div className="form-row">
                <label className="form-label">시공종류</label>
                <div className="radio-group">
                  <label><input type="radio" name="constructionType" value="시공" checked={formData.constructionType === '시공'} onChange={handleChange} /> 시공</label>
                  <label><input type="radio" name="constructionType" value="AS" checked={formData.constructionType === 'AS'} onChange={handleChange} /> AS</label>
                  <label><input type="radio" name="constructionType" value="하자보수" checked={formData.constructionType === '하자보수'} onChange={handleChange} /> 하자보수</label>
                </div>
              </div>

              <div className="form-row">
                <label className="form-label">접수형태 <span className="star">*</span></label>
                <div className="radio-group">
                  <label><input type="radio" name="receptionType" value="음성계약" checked={formData.receptionType === '음성계약'} onChange={handleChange} /> 음성계약</label>
                  <label><input type="radio" name="receptionType" value="박람회" checked={formData.receptionType === '박람회'} onChange={handleChange} /> 박람회</label>
                  <label><input type="radio" name="receptionType" value="옵션" checked={formData.receptionType === '옵션'} onChange={handleChange} /> 옵션</label>
                </div>
              </div>

              <div className="form-row">
                <label className="form-label">계약담당 <span className="star">*</span></label>
                <input type="text" name="manager" value={formData.manager} onChange={handleChange} required className="underline-input medium" />
              </div>

              <div className="form-row">
                <label className="form-label">현장</label>
                <div className="multi-input-group">
                  <input type="text" name="aptName" placeholder="아파트명" value={formData.aptName} onChange={handleChange} className="underline-input" />
                  <input type="text" name="dong" placeholder="동" value={formData.dong} onChange={handleChange} className="underline-input short" />
                  <input type="text" name="ho" placeholder="호" value={formData.ho} onChange={handleChange} className="underline-input short" />
                  <input type="text" name="type" placeholder="타입" value={formData.type} onChange={handleChange} className="underline-input short" />
                  <input type="text" name="pyeong" placeholder="평" value={formData.pyeong} onChange={handleChange} className="underline-input short" />
                </div>
              </div>

              <div className="form-row">
                <label className="form-label">계약일 <span className="star">*</span></label>
                <input type="date" name="contractDate" value={formData.contractDate} onChange={handleChange} required className="underline-input medium" />
              </div>

              <div className="form-row">
                <label className="form-label">입주예정일</label>
                <input type="date" name="moveInDate" value={formData.moveInDate} onChange={handleChange} className="underline-input medium" />
              </div>

              <div className="form-row">
                <label className="form-label">세금계산서 <span className="star">*</span></label>
                <div className="radio-with-input">
                  <label><input type="radio" name="taxInvoice" value="미발행" checked={formData.taxInvoice === '미발행'} onChange={handleChange} /> 미발행</label>
                  <label><input type="radio" name="taxInvoice" value="발행" checked={formData.taxInvoice === '발행'} onChange={handleChange} /> 발행</label>
                  <input type="text" name="taxInvoiceNum" placeholder="세금계산서 발행번호 입력" value={formData.taxInvoiceNum} onChange={handleChange} className="underline-input long" />
                </div>
              </div>

              <div className="form-row">
                <label className="form-label">현금영수증 <span className="star">*</span></label>
                <div className="radio-with-input">
                  <label><input type="radio" name="cashReceipt" value="미발행" checked={formData.cashReceipt === '미발행'} onChange={handleChange} /> 미발행</label>
                  <label><input type="radio" name="cashReceipt" value="발행" checked={formData.cashReceipt === '발행'} onChange={handleChange} /> 발행</label>
                  <input type="text" name="cashReceiptPhone" placeholder="현금영수증 발행 전화번호" value={formData.cashReceiptPhone} onChange={handleChange} className="underline-input long" />
                </div>
              </div>
            </section>

            <section className="form-section">
              <div className="section-header">
                <h3>계약금액정보</h3>
              </div>

              <div className="form-row">
                <label className="form-label">최종시공금액</label>
                <input type="number" name="totalAmount" value={formData.totalAmount} onChange={handleChange} className="underline-input long" />
              </div>

              <div className="form-row">
                <label className="form-label">최종할인금액</label>
                <div className="input-with-desc">
                  <input type="number" name="discountAmount" value={formData.discountAmount} onChange={handleChange} className="underline-input long" />
                  <span className="input-desc">(할인금액,상품권등)</span>
                </div>
              </div>

              <div className="form-row">
                <label className="form-label">최종계약금</label>
                <input type="number" name="contractAmount" value={formData.contractAmount} onChange={handleChange} className="underline-input long" />
              </div>

              <div className="form-row">
                <label className="form-label">최종잔금</label>
                <div className="input-with-desc">
                  <input type="number" name="balanceAmount" value={formData.balanceAmount} onChange={handleChange} className="underline-input long" />
                  <span className="input-desc">(최종시공금액-최종할인금액-입금금액)</span>
                </div>
              </div>
            </section>

            <div className="form-footer-buttons">
              <button type="submit" className="btn-form-blue">확인</button>
              <button type="button" className="btn-form-blue" onClick={onClose}>취소</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}