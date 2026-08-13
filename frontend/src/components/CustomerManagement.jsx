import React, { useState } from 'react';

const initialCustomers = [
  { id: 1101, userType: '개인', name: '추가)이다움', phone1: '010-9165-3263', phone2: '', zipcode: '', address1: '', address2: '' },
  { id: 1100, userType: '개인', name: '추가)장혜연', phone1: '010-8435-1596', phone2: '', zipcode: '', address1: '', address2: '' },
  { id: 1099, userType: '기업', name: '학산 한신 (가)', phone1: '010-9640-0788', phone2: '', zipcode: '', address1: '', address2: '' },
  { id: 1098, userType: '개인', name: '윤석주', phone1: '010-9495-1563', phone2: '', zipcode: '', address1: '', address2: '' },
  { id: 1097, userType: '개인', name: '조은주', phone1: '010-6623-5822', phone2: '', zipcode: '', address1: '', address2: '' },
  { id: 1096, userType: '개인', name: '김해나', phone1: '010-6469-4578', phone2: '', zipcode: '', address1: '', address2: '' },
  { id: 1095, userType: '개인', name: '김기도', phone1: '010-6378-8774', phone2: '010-3475-1755', zipcode: '', address1: '', address2: '' }
];

export default function CustomerManagement() {
  const [customers, setCustomers] = useState(initialCustomers);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // 모달 폼 전용 상태값 (이미지 입력 항목 일치)
  const [formData, setFormData] = useState({
    userType: '개인',
    name: '',
    phone1_1: '010',
    phone1_2: '',
    phone1_3: '',
    phone2_1: '010',
    phone2_2: '',
    phone2_3: '',
    zipcode: '',
    address1: '',
    address2: ''
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSearch = (e) => {
    e.preventDefault();
  };

  // 등록 확인
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('이름을 입력해 주세요.');
      return;
    }

    const phone1 = `${formData.phone1_1}-${formData.phone1_2}-${formData.phone1_3}`;
    const phone2 = formData.phone2_2 && formData.phone2_3 ? `${formData.phone2_1}-${formData.phone2_2}-${formData.phone2_3}` : '';

    const newCustomer = {
      id: customers.length > 0 ? Math.max(...customers.map(c => c.id)) + 1 : 1000,
      userType: formData.userType,
      name: formData.name,
      phone1,
      phone2,
      zipcode: formData.zipcode,
      address1: formData.address1,
      address2: formData.address2
    };

    setCustomers([newCustomer, ...customers]);
    setIsAddModalOpen(false);
    setFormData({
      userType: '개인',
      name: '',
      phone1_1: '010',
      phone1_2: '',
      phone1_3: '',
      phone2_1: '010',
      phone2_2: '',
      phone2_3: '',
      zipcode: '',
      address1: '',
      address2: ''
    });
    alert('계약자가 정상적으로 등록되었습니다.');
  };

  const handleDelete = (id) => {
    if (window.confirm('해당 계약자를 삭제하시겠습니까?')) {
      setCustomers(customers.filter(c => c.id !== id));
    }
  };

  const filteredCustomers = customers.filter(c =>
    c.name.includes(searchQuery) || c.phone1.includes(searchQuery)
  );

  return (
    <div className="customer-management-container">
      <div className="page-header">
        <h2>계약자 관리</h2>
        <ul className="notice-list">
          <li>계약을 등록하기 위한 계약자 기본정보를 등록하는 리스트입니다.</li>
          <li>아래 등록하기 버튼을 클릭 후 등록을 계약자 등록을 진행해 주세요.</li>
        </ul>
      </div>

      <div className="customer-action-bar">
        <div className="search-box">
          <input 
            type="text" 
            placeholder="이름 또는 연락처 검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="customer-search-input"
          />
          <button type="button" className="btn-search-icon" onClick={handleSearch}>🔍</button>
        </div>
        <button type="button" className="btn-add-customer" onClick={() => setIsAddModalOpen(true)}>
          + 등록하기
        </button>
      </div>

      <div className="table-responsive">
        <table className="customer-table">
          <thead>
            <tr>
              <th>번호</th>
              <th>이름</th>
              <th>연락처 ①</th>
              <th>연락처</th>
              <th>이메일</th>
              <th>주소</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#888' }}>
                  등록된 계약자가 없습니다.
                </td>
              </tr>
            ) : (
              filteredCustomers.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td className="text-left bold-text">{item.name}</td>
                  <td>{item.phone1}</td>
                  <td>{item.phone2 || '-'}</td>
                  <td>-</td>
                  <td className="text-left">
                    {item.address1 ? `${item.address1} ${item.address2}` : '-'}
                  </td>
                  <td>
                    <div className="table-action-btns">
                      <button type="button" className="btn-edit-icon" title="수정">✏️</button>
                      <button type="button" className="btn-delete-icon" onClick={() => handleDelete(item.id)} title="삭제">🗑️</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 이미지 기반 계약자 등록 모달 팝업 */}
      {isAddModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddModalOpen(false)}>
          <div className="customer-reg-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-top-bar">
              <h3>&gt; 계약자 등록</h3>
              <button className="modal-close-x" onClick={() => setIsAddModalOpen(false)}>&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="reg-table-form">
              <table className="form-grid-table">
                <tbody>
                  <tr>
                    <td className="label-col">유형분류</td>
                    <td className="input-col">
                      <label className="radio-item">
                        <input 
                          type="radio" 
                          name="userType" 
                          value="개인" 
                          checked={formData.userType === '개인'} 
                          onChange={handleInputChange} 
                        />
                        개인
                      </label>
                      <label className="radio-item">
                        <input 
                          type="radio" 
                          name="userType" 
                          value="기업" 
                          checked={formData.userType === '기업'} 
                          onChange={handleInputChange} 
                        />
                        기업
                      </label>
                    </td>
                  </tr>

                  <tr>
                    <td className="label-col">이름<span className="star">*</span></td>
                    <td className="input-col">
                      <input 
                        type="text" 
                        name="name" 
                        value={formData.name} 
                        onChange={handleInputChange} 
                        className="input-text name-input" 
                        required 
                      />
                    </td>
                  </tr>

                  <tr>
                    <td className="label-col">연락처 ①<span className="star">*</span></td>
                    <td className="input-col">
                      <div className="phone-group">
                        <input type="text" name="phone1_1" value={formData.phone1_1} onChange={handleInputChange} className="input-text phone-part" />
                        <span>-</span>
                        <input type="text" name="phone1_2" value={formData.phone1_2} onChange={handleInputChange} className="input-text phone-part" maxLength={4} required />
                        <span>-</span>
                        <input type="text" name="phone1_3" value={formData.phone1_3} onChange={handleInputChange} className="input-text phone-part" maxLength={4} required />
                        <span className="info-guide">
                          ⓘ 기존에 등록된 연락처 중 입력한 연락처와 일치하는 경우가 있다면 아래영역에 표시됩니다.
                        </span>
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td className="label-col">연락처 ②</td>
                    <td className="input-col">
                      <div className="phone-group">
                        <input type="text" name="phone2_1" value={formData.phone2_1} onChange={handleInputChange} className="input-text phone-part" />
                        <span>-</span>
                        <input type="text" name="phone2_2" value={formData.phone2_2} onChange={handleInputChange} className="input-text phone-part" maxLength={4} />
                        <span>-</span>
                        <input type="text" name="phone2_3" value={formData.phone2_3} onChange={handleInputChange} className="input-text phone-part" maxLength={4} />
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td className="label-col">주소</td>
                    <td className="input-col">
                      <div className="address-group">
                        <div className="zip-row">
                          <input type="text" name="zipcode" value={formData.zipcode} onChange={handleInputChange} className="input-text zip-input" readOnly placeholder="" />
                          <button type="button" className="btn-dark-sm" onClick={() => alert('우편번호 검색 기능은 서버 연동 후 제공됩니다.')}>우편번호</button>
                          <input type="text" name="address1" value={formData.address1} onChange={handleInputChange} className="input-text addr-input" placeholder="주소1" />
                          <input type="text" name="address2" value={formData.address2} onChange={handleInputChange} className="input-text addr-input" placeholder="주소2" />
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="form-bottom-btns">
                <button type="submit" className="btn-dark-lg">등록확인</button>
                <button type="button" className="btn-dark-lg cancel" onClick={() => setIsAddModalOpen(false)}>취소</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}