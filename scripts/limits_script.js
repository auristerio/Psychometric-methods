const patientName = document.getElementById("patientName")
const patientGender = document.getElementById("patientGender")
const newPatientBtn = document.getElementById("newPatientBtn")
const presentBtn = document.getElementById("presentBtn")
const intValue = document.getElementById("intValue")
const negative = document.getElementById("negative")
const positive = document.getElementById("positive")
const increaseBtn = document.getElementById("increaseBtn")
const decreaseBtn = document.getElementById("decreaseBtn")
const step = document.getElementById("step");
const confirmBtn = document.getElementById("confirmBtn");
const estimate = document.getElementById("estimate");
const feedback = document.getElementById("feedback");

let patientImg = document.getElementById("patientImg")
let patientThreshold;
let response;


const maleNames = ["Alex", "Bob", "Charlie", "David"
    , "Fernand", "Oliver", "Bruce", "Bill", "Tony", "William"
]

const femaleNames = ["Alice", "Elizabeth", "Susan", "Margaret",
    "Jennifer", "Jessica", "Laura", "Anna", "Emma", "Sharon"
]

const genders = ["Male", "Female"]

function generatePatient() {
    feedback.classList.remove("on")
    estimate.value = 0
    intValue.value = 10
    const randomGender = genders[Math.floor(Math.random() * genders.length)];
    let randomName;
    let randomPic;
    const randomThreshold = Math.floor(Math.random() * 120)
    if (randomGender === "Male") {
        randomName = maleNames[Math.floor(Math.random() * maleNames.length)];
        randomPic = "../images/patient.png"
    } else {
        randomName = femaleNames[Math.floor(Math.random() * femaleNames.length)];
        randomPic = "../images/female_patient.jpg"
    }
    patientName.innerHTML = randomName
    patientGender.innerHTML = randomGender
    patientImg.src = randomPic
    patientThreshold = randomThreshold
}

function testThreshold(level) {
    if (patientThreshold <= level) {
        response = true;
        positive.classList.add("active-response")
        negative.classList.remove("active-response")
    } else {
        response = false;
        positive.classList.remove("active-response")
        negative.classList.add("active-response")
    }
}

function resetResponse() {
    positive.classList.remove("active-response")
    negative.classList.remove("active-response")
}

generatePatient();
newPatientBtn.addEventListener("click", generatePatient);
increaseBtn.addEventListener("click", () => {
    resetResponse()
    intValue.value = Number(intValue.value) + Number(step.value)
});
decreaseBtn.addEventListener("click", () => {
    resetResponse()
    intValue.value = Number(intValue.value) - Number(step.value)
});
presentBtn.addEventListener("click", () => {
    testThreshold(intValue.value);
});
confirmBtn.addEventListener("click", () => {
    resetResponse()
    if (Number(estimate.value) === patientThreshold) {
        feedback.innerHTML = "Correct! Congrats!"
        feedback.classList.add("on")
    } else {
        feedback.innerHTML = `Sorry! The correct answer was ${patientThreshold}!`
        feedback.classList.add("on")
    }
});
