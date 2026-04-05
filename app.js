const express = require('express');
const XLSX = require('xlsx');
const path = require("path");
const fs = require('fs');

const app = express();
app.use(express.json());

// 엑셀에 데이터 쓰기
function saveRecord(newRecord, res) {
    let records = [];

    // 데이터 중복 제거
    newRecord.forEach(record => {
        records.push(record);
    });
    const deletedDuplication = Array.from(new Set(records.map(JSON.stringify)))
        .map(JSON.parse);

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
        req.body.forEach(data => {
            const { eat, allergy, status, name } = data; // name은 프론트에서 받아옴
            const studentId = data.student_id;
            const category = data.symptom_cat;
            const detail = data.symptom_detail;
            const date = data.created_at.substr(0, 10);
            const prescription = data.treatment_record;

            // 알러지, 식사 여부 O, X로 변환
            let eatTxt = "X", allergyTxt = "X";
            if (eat) { eatTxt = "O" }
            if (allergy) { allergyTxt = "O" }

            // 처리 여부 한글 변환
            let statusTxt = "처리 중"
            if (status === "done") { statusTxt = "처리 완료" }

            // 엑셀에 저장할 데이터 생성
            const record = {
                "날짜": date,
                "학번": studentId,
                "이름": name || null, // 프론트에서 받아온 이름
                "식사 여부": eatTxt,
                "알러지 여부": allergyTxt,
                "증상": category,
                "세부 증상": detail,
                "처방 내용": prescription,
                "처리 상태": statusTxt
            };
            records.push(record);

            //////// 수동 입력 기능 추가 /////////

        });
        // console.log(records.reverse())
        saveRecord(records.toReversed(), res); // 최신 기록이 위에 오도록 진료 기록 리스트 반전
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: error.message });
    }
});

// 정적 파일 서빙
app.use(express.static(path.join(__dirname, "public")));

// 메인 페이지 라우팅
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 서버 실행
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`http://localhost:${PORT} 실행중`);
});
