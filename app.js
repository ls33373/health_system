const express = require('express');
const XLSX = require('xlsx');
const path = require("path");
const fs = require('fs');
const { json } = require('body-parser');

const app = express();
app.use(express.json());

// 서버 실행 시 학생 명단 불러오기
const studentWorkbook = XLSX.readFile("명렬표.xlsx");
const studentSheet = studentWorkbook.Sheets[studentWorkbook.SheetNames[0]];
const studentData = XLSX.utils.sheet_to_json(studentSheet);

const studentMap = new Map();
studentData.forEach(row => {
    studentMap.set(String(row.학번), row.이름);
});

console.log("학생 데이터 로딩 완료");

// 엑셀에 데이터 쓰기
function saveRecord(newRecord, res) {
    let records = [];

    // 기존 파일 있으면 읽기
    if (fs.existsSync('records.xlsx')) {
        const workbook = XLSX.readFile('records.xlsx');
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        records = XLSX.utils.sheet_to_json(sheet);
    }

    // 데이터 중복 제거
    newRecord.forEach(record => {
        records.push(record); // 새로운 데이터 전부 추가
    });
    const deletedDuplication = Array.from(new Set(records.map(JSON.stringify)))
        .map(JSON.parse); // 집합(Set) 활용 -> 데이터 중복 제거

    // 다시 엑셀로 변환
    const newSheet = XLSX.utils.json_to_sheet(deletedDuplication);
    const newWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWorkbook, newSheet, 'Records');

    // 파일 생성 후 다운로드
    const buffer = XLSX.write(newWorkbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename=records.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
}

// POST 요청 -> 엑셀에 데이터 저장
app.post('/save', (req, res) => {
    try {
        let records = [];
        // console.log(req.body)
        req.body.forEach(data => {
            const { eat, allergy, status } = data;
            const studentId = data.student_id;
            const category = data.symptom_cat;
            const detail = data.symptom_detail;
            const date = data.created_at.substr(0, 10);
            const prescription = data.treatment_record;
            
            let name = studentMap.get(studentId);
          
            // 이름이 없는 경우 -> 이름 공란 처리
            if (!name) {
              name = null;
            }
          
            // 알러지, 식사 여부 O, X로 변환
            let eatTxt = "X", allergyTxt = "X";
            if (eat) { eatTxt = "O" } // 식사 여부
            if (allergy) { allergyTxt = "O" } // 알러지 여부
          
            // 처리 여부 한글 변환
            let statusTxt = "처리 중"
            if (status === "done") { statusTxt = "처리 완료" }
    
            // 엑셀에 저장할 데이터 생성
            const record = {
                "날짜": date,
                "학번": studentId,
                "이름": name,
                "식사 여부": eatTxt,
                "알려지 여부": allergyTxt,
                "증상": category,
                "세부 증상": detail,
                "처방 내용": prescription,
                "처리 상태": statusTxt
            };
            records.push(record); // 새로운 데이터 추가  
        })
        saveRecord(records, res);
    } catch (error) {
        console.error(error);  // 터미널에 출력
        return res.status(500).json({ message: error.message });  // error 대신 error.message
    }
});

// 정적 파일 서빙
app.use(express.static(path.join(__dirname, "public")));

// 메인 페이지 라우팅
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
})

// 서버 실행
app.listen(3000, () => {
    console.log('http://localhost:3000 실행중');
});