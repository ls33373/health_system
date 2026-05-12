// ============================================================
// 1. Supabase 설정
// ============================================================
const SB_URL = 'https://akkdzfuauaeukqhdrydp.supabase.co'; 
const SB_KEY = 'sb_publishable_aVul9T_gOi8NDd70diW_gA_q0Yzwotl';
const _supabase = supabase.createClient(SB_URL, SB_KEY);

// ============================================================
// 2. 설정: 증상별 대기 시간 가중치
// ============================================================
const TIME_WEIGHTS = {
    '감기/발열': 5,
    '두통': 5,
    '복통': 5,
    '외상(상처)': 5,
    '근골격계': 5,
    '기타': 5
};

// ============================================================
// 3. 화면 전환 함수
// ============================================================
function showView(viewId) {
    // 모든 뷰 숨기기
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
        view.classList.add('hidden'); 
    });

    // 선택한 뷰 보이기
    const nextView = document.getElementById(viewId);
    if (nextView) {
        nextView.classList.remove('hidden');
        setTimeout(() => nextView.classList.add('active'), 10);
        
        // 관리자 화면으로 갈 때 데이터 불러오기
        if (viewId === 'view-admin') fetchLogs();
    }
}

// ===========================
// 모달 숨기기, 보이기 함수
// ===========================
function modalControl(modal, mode) {
    modal.style.opacity = mode === "show" ? "1" : "0";
    modal.style.pointerEvents = mode === "show" ? "auto" : "none";
}

// ============================================================
// 학생 접수 함수 (알림을 모달로 변경)
// ============================================================
async function submitLog() {
    const stId = document.getElementById('stId').value;
    const cat = document.getElementById('stCat').value;
    const detail = document.getElementById('stDetail').value;

    const foodChecked = document.querySelector('input[name="food"]:checked');
    const allergyChecked = document.querySelector('input[name="allergy"]:checked');

    // [추가] 개인정보 동의 체크했는지 확인하기
    const privacyAgree = document.getElementById('privacyAgree');
    if (privacyAgree && !privacyAgree.checked) {
        showModal("개인정보 수집 및 이용에 동의해야 접수가 가능합니다.");
        return; // 체크 안 했으면 여기서 멈춤 (접수 안 됨)
    }

    // 1. 필수 입력 검사 (alert 대신 showModal 사용)
    if (!stId) {
        showModal("학번을 입력해주세요!");
        return;
    }
    if (!foodChecked) {
        showModal("식사 여부를 체크해주세요!");
        return;
    }
    if (!allergyChecked) {
        showModal("약물 알러지 여부를 체크해주세요!");
        return;
    }

    const food = foodChecked.value === 'true';
    const allergy = allergyChecked.value === 'true';

    // 2. DB에 전송
    const { error } = await _supabase.from('health_logs').insert([{
        student_id: stId, eat: food, allergy: allergy, 
        symptom_cat: cat, symptom_detail: detail, status: 'waiting',
        is_agreed: true
    }]);

    if (error) {
        showModal("오류 발생: " + error.message);
    } else {
        // 성공 시 띄우는 알림도 모달로 변경
        showModal("접수가 완료되었습니다.\n자리에 앉아 대기해주세요.");
        
        // 3. 폼 초기화
        document.getElementById('stId').value = '';
        document.getElementById('stDetail').value = '';
        if (foodChecked) foodChecked.checked = false;
        if (allergyChecked) allergyChecked.checked = false;
        
        // 대기 인원 갱신 및 첫 화면으로 이동
        init(); 
        showView('view-login');
    }
}

// ============================================================
// 5. 관리자 목록 불러오기 (처방 내역 입력칸 추가)
// ============================================================
async function fetchLogs() {
    // 💡 [수정됨] .select('*') 로 처리하면 모든 컬럼을 가져옵니다. 
    // 만약 특정 컬럼만 가져오고 있다면 treatment_record를 명시해야 합니다.
    const { data, error } = await _supabase.from('health_logs')
        .select('*') 
        .order('created_at', { ascending: false })
        .limit(50);
    
    if (error) return console.error("목록 로딩 실패:", error);

    const body = document.getElementById('log-body');

    // [현장 접수용 맨 윗줄]
    const inputRow = `
        <tr style="background: rgba(0, 122, 255, 0.05);">
            <td style="font-weight:bold; color:var(--ios-blue);">현장<br>접수</td>
            <td><input type="text" id="directId" placeholder="학번" /></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td>
                <button class="btn-primary" style="padding:0.5vh 1.5vh; font-size:1.5vh; border-radius:1vh; border:none; cursor:pointer; white-space:nowrap;" onclick="submitDirectLog()">+ 추가</button>
            </td>
            <td></td>
        </tr>
    `;

    // [기존 대기 학생 목록]
    const dataRows = data.map(log => {
        const timeStr = new Date(log.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        const eatDisplay = log.eat ? '<span style="color:blue; font-weight:bold;">O</span>' : '<span style="color:#ccc">X</span>';
        const allergyDisplay = log.allergy ? '<span style="color:red; font-weight:bold;">O</span>' : '<span style="color:#ccc">X</span>';

        return `
        <tr>
            <td>${timeStr}</td>
            <td>${log.student_id}</td>
            <td>${eatDisplay}</td>
            <td>${allergyDisplay}</td>
            <td><span class="badge">${log.symptom_cat}</span></td>
            <td style="text-align: left; font-size: 0.9em; color:#555;">${log.symptom_detail || '-'}</td>
            <td>
                ${log.status === 'waiting' 
                    ? `<input type="text" id="treat-${log.id}" placeholder="여기에 처방 기록" style="width: 100%; padding: 0.5vh; border: 1px solid #ddd; border-radius: 0.5vh; font-size: 1.5vh; outline: none;" />`
                    : `<span style="font-size: 0.9em; color:#007AFF; font-weight:500;">${log.treatment_record || '-'}</span>`}
            </td>
            <td>
                ${log.status === 'waiting' 
                    ? `<button class="btn-primary" style="padding:5px 10px; font-size:0.8rem;" onclick="completeLog(${log.id})">진료 완료</button>` 
                    : '<span style="color:#34C759; font-weight:bold;">✅완료</span>'}
            </td>
            <td>
                <button class="btn-primary" style="padding:0.5vh 1.5vh; font-size:1.5vh; border-radius:1vh; border:none; cursor:pointer; white-space:nowrap;" onclick="editContent(this)">수정</button>
            </td>
        </tr>
    `}).join('');
    
    body.innerHTML = inputRow + dataRows;
}

// ============================================================
// 6. [수정됨] 완료 처리 (처방 내역 DB 반영 로직 추가)
// ============================================================
async function completeLog(id) {
    // 💡 [수정] 입력창에서 처방 내역 가져오기
    const treatmentText = document.getElementById(`treat-${id}`).value;
    
    if(!confirm("진료를 완료 처리하시겠습니까?")) return;
    
    // 1. DB 업데이트 (treatment_record 추가!)
    const { error } = await _supabase
        .from('health_logs')
        .update({ 
            status: 'done',
            treatment_record: treatmentText // 👈 DB에 내역 저장!
        })
        .eq('id', id);

    if (error) {
        alert("처리에 실패했습니다: " + error.message);
    } else {
        await fetchLogs(); // 리스트 갱신
        await init();      // 대기 인원수 갱신
    }
}

// ============================================================
// 7. 관리자 로그인 (DB 연동 + 예쁜 모달창 적용)
// ============================================================
async function adminLogin() {
    const pwInput = document.getElementById('pw');
    const inputPw = pwInput.value;
    
    // DB에서 관리자 비밀번호 가져오기 (코드에 비밀번호 노출 X)
    const { data, error } = await _supabase.from("login").select("*").eq("id", 1).single();
    
    if (error || !data) {
        showModal("관리자 정보를 불러올 수 없습니다.");
        return;
    }

    if (inputPw === data.password) {
        pwInput.value = ''; // 성공 시 입력칸 비우기
        showView('view-admin');

        // localStorage에 명렬표가 저장되어 있으면 파일업로드 버튼 안 띄우기
        const fileLoader = document.getElementById("file-upload");
        const studentMap = localStorage.getItem("studentMap");
        if (studentMap) { // 명렬표가 존재하면 -> 버튼 숨김 처리
            fileLoader.classList.add("hidden");
        } else { // 존재하지 않으면 -> 버튼 보이기
            fileLoader.classList.remove("hidden");
        }
    } else if (inputPw !== "") {
        // 기존 alert 대신 예쁜 모달창 띄우기
        showModal("비밀번호가 틀렸습니다.\n다시 확인해주세요.");
        pwInput.value = ''; // 실패 시 다시 입력할 수 있게 칸 비우기
    }
}


// ============================================================
// 8. 엑셀 다운로드
// ============================================================
async function downloadCSV(filename, startDate, endDate) {
    const fileLoader = document.getElementById("file-upload");
    if (!fileLoader.classList.contains("hidden")) { // 명렬표 파일이 업로드 되지 않은 경우
        alert("먼저 명렬표 파일을 업로드 한 후에 시도하세요.");
    } else {
        const { data } = await _supabase.from('health_logs') // DB에서 데이터 받아오기
            .select('*')
            .gte("created_at", startDate)
            .lte("created_at", endDate)
            .order("created_at", { ascending: true });
        
        // localStorage에서 명렬표 불러와서 이름 추가
        const studentMap = JSON.parse(localStorage.getItem("studentMap") || "{}");
        const dataWithName = data.map(row => ({
            ...row,
            name: studentMap[String(row.student_id)] || null
        }));

        // 서버에 요청 보내기
        fetch("/save", {
            method: "POST",
            headers: {
                "Content-type": "application/json"
            },
            body: JSON.stringify(dataWithName)
        })
        .then((res) => {
            if (!res.ok) throw new Error('서버 오류');  // 에러 응답 체크
            return res.blob();
        })
        .then((blob) => { // 다운로드 URL 생성 후 자동 클릭 처리 -> 파일 다운로드
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            
            const today = new Date().toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).replace(/\. /g, '-').replace('.', ''); // 2026-03-25 형태로 변환

            a.download = `${filename}.xlsx`;
            
            a.click();
            URL.revokeObjectURL(url);
        })
        .catch((error) => console.error(error.message))
    }
}

// 날짜 포멧팅 함수
function dateFormatting(date, type) {
    const yyyy = date.slice(0, 4);
    const mm = date.slice(5, 7).padStart(2, "0");
    const dd = date.slice(8, 10).padStart(2, "0");

    if (type === "yyyy-mm-dd") { // 연-월-일    
        return `${yyyy}-${mm}-${dd}`;
    } else if (type === "yyyy년 mm월 dd일") {
        return `${yyyy}년 ${mm}월 ${dd}일`;
    } else if (type === "ISO-M") { // ISO 형식(최대 수치)
        return `${yyyy}-${mm}-${dd}T23:59:59Z`;
    } else if (type === "ISO-m") { // ISO 형식(최소 수치)
        return `${yyyy}-${mm}-${dd}T00:00:00Z`;
    }
}

// 기간 선택 모달
function downloadModal() {
    const downloadModal = document.getElementById("download-modal");
    modalControl(downloadModal, "show");
}

// 다운로드
function startDownload() {
    const startDate = document.getElementById("select-start-date").value;
    const endDate = document.getElementById("select-end-date").value;

    // console.log(dateFormatting(startDate, "yyyy년 mm월 dd일"), dateFormatting(endDate, "yyyy년 mm월 dd일"),
    //             dateFormatting(startDate, "ISO-m"), dateFormatting(endDate, "ISO-M"))


    // const radios = document.getElementsByName("period");
    // var checkedBtn;

    // radios.forEach(btn => {
    //     if (btn.checked) { checkedBtn = btn }
    // });

    // // 데이터 시작 날짜 계산
    // const today = new Date();
    // const startDate = new Date(today.setDate(today.getDate() - Number(checkedBtn.value)));
    
    // 엑셀 파일 다운로드
    downloadCSV(`보건실 이용 기록(${dateFormatting(startDate, "yyyy년 mm월 dd일")}~${dateFormatting(endDate, "yyyy년 mm월 dd일")})`,
                dateFormatting(startDate, "ISO-m"), dateFormatting(endDate, "ISO-M"));

    // console.log(dateFormatting(startDate, "ISO-m"), dateFormatting(new Date(), "ISO-M"))
}

// ========================
// 수동 입력 기능
// ========================
// function loadValue() {
//     const idInput = document.getElementById("manual-student-id");
//     const dateInput = document.getElementById("manual-date");
//     const eatInput = document.getElementById("manualEat");
//     const allergyInput = document.getElementById("manualAllergy");
//     const catInput = document.getElementById("manualCat");
//     const detailInput = document.getElementById("manualDetail");
//     const treatmentInput = document.getElementById("manualTreatment");

//     return dateInput.value, idInput.value, eatInput.value, allergyInput.value,
//             catInput.value, detailInput.value, treatmentInput.value;
// }

// function manualInput() {
//     // 모달 보이기
//     const modal = document.getElementById('manual-input-modal');
//     modal.style.opacity = '1';
//     modal.style.pointerEvents = 'auto';

//     // 입력창 초기화
//     const { date, id, eat, allergy, cat, detail, treatment } = loadValue();
//     [date, id, eat, allergy, cat, detail, treatment].forEach(e => {
//         e.value = "";
//     });
// }

// async function saveData() {
//     const { date, id, eat, allergy, cat, detail, treatment } = loadValue();

//     // 데이터 검사
//     // const objectList = [date, id, eat, allergy, cat, detail, treatment];
//     // const textList = ["날짜", "학번", "식사 여부", "알러지 여부", "증상", "자세한 증상", "진료/처방 내역"]
//     // for (let i = 0; i > 7; i++) {
//     //     if (!objectList[i]) { alert(`${textList[i]}을/를 입력해주세요.`); break }
//     // }

//     // // DB에 저장
//     // const { error } = await _supabase.from('health_logs').insert([{
//     //     created_at: date,
//     //     student_id: id, 
//     //     name: null, 
//     //     eat: eat, 
//     //     allergy: allergy, 
//     //     symptom_cat: cat, 
//     //     symptom_detail: detail, 
//     //     treatment_record: treatment, // 추가됨
//     //     status: 'done' // 현장 접수 후 완료 처리를 위해 일단 대기로 둠 (원하면 'done'으로 변경 가능)
//     // }]);

//     // if (error) {
//     //     alert("오류 발생: " + error.message);
//     // } else {
//     //     await fetchLogs();
//     //     await init();
//     // }
// }

// ================================================
// 명렬표 업로드
// ================================================

function uploadStudents() {
    const file = document.getElementById('studentFile').files[0];
    if (!file) return alert('파일을 선택해주세요.');

    const reader = new FileReader();
    reader.onload = function(e) {
        const workbook = XLSX.read(e.target.result, { type: 'binary' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet);

        // { 학번: 이름 } 형태로 변환해서 localStorage에 저장
        const studentMap = {};
        data.forEach(row => {
            studentMap[String(row.학번)] = row.이름;
        });
        localStorage.setItem('studentMap', JSON.stringify(studentMap));

        // 파일 업로더 숨김 처리
        const fileLoader = document.getElementById("file-upload");
        fileLoader.classList.add("hidden");

        console.log(`명렬표 저장 완료: ${data.length}명`);
    };
    reader.readAsBinaryString(file);
}

// ============================================================
// 9. 날씨 가져오기
// ============================================================
async function getWeather() {
    try {
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=37.4208&longitude=127.1265&current_weather=true');
        const data = await res.json();
        const temp = data.current_weather.temperature;
        
        document.getElementById('w-temp').innerText = `성남 ${temp}°C`;
        document.getElementById('w-icon').className = 'fa-solid fa-cloud-sun';
    } catch (e) {
        console.log("날씨 로딩 실패");
        document.getElementById('w-temp').innerText = "날씨 정보 없음";
    }
}

// ============================================================
// 10. 초기화 및 대기 인원 계산
// ============================================================
async function init() {
    // 'waiting' 상태인 사람만 가져옴
    const { data, count, error } = await _supabase
        .from('health_logs')
        .select('symptom_cat', { count: 'exact' })
        .eq('status', 'waiting');

    if (!error) {
        let totalMinutes = 0;
        if (data) {
            data.forEach(log => totalMinutes += (TIME_WEIGHTS[log.symptom_cat] || 5));
        }

        const infoDiv = document.getElementById('main-wait-info');
        if (count > 0) {
            infoDiv.innerHTML = `
                <h1 style="font-size: 80px; margin:10;" class="widget-number">${count}명</h1>
                <p style="font-size:1.3rem; margin-top:5px; color:#555;">(약 ${totalMinutes}분 대기)</p>
            `;
        } else {
            infoDiv.innerHTML = `
                <h1 class="widget-number" style="color:#000000; font-size:80px; margin:10;">0명</h1>
                <p style="font-size:1.3rem; margin-top:5px; color:#000000 ; font-weight:bold;">바로 진료 가능</p>
            `;
        }
    }
    
    // 관리자 화면이 켜져있으면 리스트도 같이 갱신
    if(document.getElementById('view-admin').classList.contains('active')){
        fetchLogs();
    }
}

// ============================================================
// 11. 실시간 감지 (보조 역할)
// ============================================================
// 다른 컴퓨터에서 접속했을 때 업데이트를 받기 위한 용도입니다.
_supabase
  .channel('public:health_logs')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'health_logs' }, (payload) => {
      console.log('DB 변경됨:', payload);
      init(); 
  })
  .subscribe();

// 페이지 로드 시 실행
window.addEventListener('DOMContentLoaded', () => {
    const loginView = document.getElementById('view-login');
    loginView.classList.remove('hidden');
    setTimeout(() => loginView.classList.add('active'), 10);
    
    getWeather();
    init();
});

// ============================================================
// 선생님 표에서 직접 현장 접수하기
// ============================================================
async function submitDirectLog() {
    const stId = document.getElementById('directId');

    if (!stId.value) { return alert("학번을 입력해주세요."); }
    else { localStorage.setItem("student_id", stId.value); } // 학번 저장

    // 개인별 진료 기록 모달에서 나머지 내용 입력받기
    loadRecord() // 모달창 띄우기

    // 학번 입력값 삭제
    stId.value = "";
}

// ============================================================
// 커스텀 알림 모달 제어 함수
// ============================================================

// 일반 알림 모달
function showModal(msg) {
    document.getElementById('modal-message').innerText = msg;
    const modal = document.getElementById('custom-modal');
    modalControl(modal, "show");
}

function closeModal() {
    const modal = document.getElementById('custom-modal');
    modalControl(modal, "hide");
}

// 내용 수정 모달
function showCustomModal(modal) {
    modalControl(modal, "show");
}

async function closeEditModal(type, object) {
    if (type === "edit") {
        // 수정된 데이터 저장
        const studentId = document.getElementById("editId").innerText
        const editedEat = document.getElementById("editEat").value
        const editedAllergy = document.getElementById("editAllergy").value
        const editedCat = document.getElementById("editCat").value
        const editedDetail = document.getElementById("editDetail").value
        const editedTreatment = document.getElementById("editTreatment").value
    
        // 시간 데이터 불러오기
        const logedTime = localStorage.getItem("time")
    
        // DB에 반영
        const newData = {
            student_id: studentId, eat: editedEat, allergy: editedAllergy,
            symptom_cat: editedCat, symptom_detail: editedDetail, treatment_record: editedTreatment
        }
    
        const { data, error } = await _supabase.from('health_logs')
            .update(newData)
            .eq("created_at", logedTime)
            .eq("student_id", studentId)
    } else if (type === "new") {

    }

    // 모달 창 닫기
    const modal = document.getElementById(object.parentElement.parentElement.id)
    modalControl(modal, "hide");
}

// ============================================================
// [새로 추가] 개인정보 동의서 모달 띄우기
// ============================================================
function showPrivacyPolicy() {
    const policyText = `[개인정보 수집 · 이용 및 민감정보 처리 동의서]

1. 수집·이용 주체: 풍생고등학교 보건실 (관리책임자: 보건교사)
2. 수집 항목 (필수): 학번, 성명
3. 민감정보 수집 항목 (필수): 건강상태(증상), 진료 및 처치 기록
4. 수집·이용 목적: 보건실 방문 학생 처치, 보건일지 기록 및 응급 상황 시 보호자 연락
5. 보유 및 이용 기간: 학교보건법에 따라 작성일로부터 5년간 보관 후 파기
6. 동의 거부 권리: 귀하는 동의를 거부할 수 있습니다. 다만, 필수 항목 수집에 동의하지 않을 경우 시스템을 통한 접수가 제한되며, 
    이 경우 보건 교사에게 구두로 접수해 주시기 바랍니다.

※ 본인은 위 내용을 숙지하였으며, 개인정보 및 민감정보 수집·이용에 동의합니다.`;
    
    showModal(policyText);
}

// 내용 수정 모달
async function editContent(object) {
    // 데이터 찾을 학번 불러오기
    const selectRow = object.parentElement.parentElement.children
    const studentId = selectRow[1].innerText

    // 모달 창 닫기 버튼에 클릭 시 액션 추가
    const closeBtn = document.getElementById("edit-close-btn")

    // 학생 데이터 불러오기
    const { data, error } = await _supabase.from("health_logs").select("*").eq("student_id", studentId)
    data.forEach(d => {
        if (error || !d) {
            console.log(error)
        }
        else {
            // 수정하려는 학생의 기록이 여러개인 경우 선택한 기록만 필터링 (시간, 처방 내역으로 필터링)
            const timeStr = new Date(d.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
            const timeLog = selectRow[0].innerText
            var treatment = selectRow[6].innerText

            // 처방 내역에서 공백 제거
            treatment = treatment.replaceAll(" ", "")

            if (timeStr === timeLog && treatment === d.treatment_record.replaceAll(" ", "")) {
                const cat = selectRow[4].innerText
                const eat = selectRow[2].innerText
                const allergy = selectRow[3].innerText

                showCustomModal(document.getElementById("edit-modal"))
                // 모달에 정보 띄우기
                const catList = ["두통", "호흡기", "소화기", "순환기", "외상", "피부", "근골격계", "비뇨생식기계", "신경정신과",
                                "이비인후과", "안과", "구강", "기타"]
                const logedTime = document.getElementById("time")
                const studentIdInput = document.getElementById("editId")
                const detailInput = document.getElementById("editDetail")
                const treatmentInput = document.getElementById("editTreatment")

                const selectedCat = document.getElementById(`cat-${catList.indexOf(cat) + 1}`)
                const selectedEat = document.getElementById(`eat-${eat === "O" ? "T" : "F"}`)
                const selectedAllergy = document.getElementById(`allergy-${allergy === "O" ? "T" : "F"}`)
    
                // 입력창 내용 반영
                logedTime.innerText = timeStr
                studentIdInput.innerText = d.student_id
                detailInput.value = d.symptom_detail
                treatmentInput.value = d.treatment_record
                selectedCat.selected = true
                selectedEat.selected = true
                selectedAllergy.selected = true

                // localStorage에 시간 데이터 저장
                localStorage.setItem("time", d.created_at)
            }
        }
    })
}

// =======================
// 개인별 진료기록 확인
// =======================
function loadRecord() { // 모달 띄우기
    const recordViewModal = document.getElementById("record-view-modal");

    // 모달 보이기
    modalControl(recordViewModal, "show");

    // 입력한 학번에 해당하는 학생의 진료기록 불러오기
    const studentId = localStorage.getItem("student_id");
    searchLog(studentId);

    // 서브 타이틀 설정
    const subTitle = document.getElementById("modal-subtitle");
    subTitle.innerText = `학번 : ${studentId}`

    /////// 개인별 조회 스크롤 바 추가 //////////
}

function closeViewModal() {
    const recordViewModal = document.getElementById("record-view-modal");

    // 조회 결과 초기화
    const viewTable = document.getElementById("view-table");
    const closeBtn = document.getElementById("close-btn");
    const viewContent = document.getElementById("record-view-content");

    const rows = viewTable.querySelectorAll("tr"); 
    
    // 조회 내용만 삭제 -> 제목, 입력칸 삭제 X
    for (let i = 2; i < rows.length; i++) {
        rows[i].remove();
    }

    // 입력 내용 초기화
    const eat = document.getElementById('directEat');
    const allergy = document.getElementById('directAllergy');
    const cat = document.getElementById('directCat');
    const detail = document.getElementById('directDetail');
    const treatment = document.getElementById('directTreatment');

    eat.value = "false"; allergy.value = "false";
    cat.value = "기타";
    detail.value = ""; treatment.value = "";

    // 모달 숨기기
    modalControl(recordViewModal, "hide");
}

async function searchLog(studentId) { // 학번에 대한 진료기록 조회
    // 데이터 불러오기
    const { data, error } = await _supabase.from('health_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .eq("student_id", studentId)
    
    if (error) { alert("학생의 진료기록을 불러오는 중 오류가 발생했습니다.") }

    // 테이블에 띄우기
    const viewTable = document.getElementById("view-table");
    
    // 각 데이터별로 처리
    data.forEach(d => {
        // 각 항목별 테이블 줄 생성
        const tr = document.createElement("tr");
        viewTable.appendChild(tr);
        
        // 날짜 추가
        const timeTd = document.createElement("td");
        timeTd.innerText = new Date(d.created_at).toLocaleTimeString([], {month:'2-digit', day:'2-digit'});
        tr.appendChild(timeTd);

        // 식사 여부 추가
        const foodTd = document.createElement("td");
        foodTd.innerText = d.eat ? "O" : "X";
        tr.appendChild(foodTd);

        // 알러지 여부 추가
        const allergyTd = document.createElement("td");
        allergyTd.innerText = d.allergy ? "O" : "X";
        tr.appendChild(allergyTd);

        // 증상 추가
        const catTd = document.createElement("td");
        catTd.innerText = d.symptom_cat;
        tr.appendChild(catTd);

        // 자세한 증상 추가
        const detailTd = document.createElement("td");
        detailTd.innerText = d.symptom_detail;
        tr.appendChild(detailTd);

        // 진료/처방 내역 추가
        const treatmentTd = document.createElement("td");
        treatmentTd.innerText = d.treatment_record;
        tr.appendChild(treatmentTd);
    })
}

// ===============================
// 모달에서 데이터 저장
// ===============================
async function submitData() {
    // 입력 정보 불러오기
    const stId = localStorage.getItem("student_id");
    const eat = document.getElementById('directEat').value === 'true';
    const allergy = document.getElementById('directAllergy').value === 'true';
    const cat = document.getElementById('directCat').value;
    const detail = document.getElementById('directDetail').value;
    const treatment = document.getElementById('directTreatment').value;

    // 무결성 검사
    if (!stId) { return alert("학번이 입력되지 않았습니다.")}

    // DB에 데이터 저장 (treatment_record 추가)
    const { error } = await _supabase.from('health_logs').insert([{
        student_id: stId, 
        name: null, 
        eat: eat, 
        allergy: allergy, 
        symptom_cat: cat, 
        symptom_detail: detail, 
        treatment_record: treatment, // 추가됨
        status: 'done' // 현장 접수 후 완료 처리를 위해 일단 대기로 둠 (원하면 'done'으로 변경 가능)
    }]);

    if (error) {
        alert("오류 발생: " + error.message);
    } else {
        await fetchLogs();
        await init();
        await searchLog(stId);
    }  
}