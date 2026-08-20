import { useState } from "react";
import { Link } from "react-router-dom";
import "./components-style/Support.css";

function Support({ theme, setTheme }) {
    const [userName, setUserName] = useState("");
    const [userSurname, setUserSurname] = useState("");
    const [userEmail, setUserEmail] = useState("");
    const [userReason, setUserReason] = useState("");
    const [userMessage, setUserMessage] = useState("");

    const [userValid, setUserValid] = useState(false);

    const handleSubmit = (event) => {
        event.preventDefault();


        const isValid =
            userName.trim() !== "" &&
            userSurname.trim() !== "" &&
            userEmail.trim() !== "" &&
            userReason.trim() !== "" &&
            userMessage.trim() !== "" &&
            userEmail.includes("@") &&
            userEmail.includes(".");

        setUserValid(isValid);
        setTimeout(() => {

            if (!userEmail.includes("@") || !userEmail.includes(".")) {
                alert("Please enter the valid email")
            }
            else if (isValid) {
                alert("Your request has been successfully sent");
            }
            else if (!isValid) {
                alert("Please fill all fields")
            }
        }, 100);

    };

    return (
        <section className={`supportPage ${theme ? "supportPageLight" : ""}`}>
            <div className="supportHeader">
                <Link to="/" className="supportHomeButton">
                    <i class="fa-solid fa-circle-arrow-left"></i> Return
                </Link>
                <h1 className="supportHeaderTitle">
                    <i className="fa-solid fa-headset"></i>
                    Game Store Support
                </h1>
                <button
                    className="theme"
                    onClick={() => setTheme(!theme)}
                >
                    {theme ? <i class="fa-solid fa-moon"></i> : "☀️"}
                </button>
            </div>


            <form action="" className={userValid ? "supportFormValid" : ""}>

                <div className="supportMainRow">
                    <div className="supportField supportField1">
                        <label htmlFor="">First name</label>
                        <input onChange={(e) => { setUserName(e.target.value);  setUserValid(false);  }} type="text" className="supportName" placeholder="Enter your name" />
                    </div>
                    <div className="supportField supportField1">
                        <label htmlFor="">Surname</label>
                        <input onChange={(e) => { setUserSurname(e.target.value);  setUserValid(false);  }} type="text" className="supportName" placeholder="Enter your surname" />
                    </div>
                </div>

                <div className="supportMainRow">
                    <div className="supportField">
                        <label htmlFor="">Email</label>
                        <input onChange={(e) => { setUserEmail(e.target.value);  setUserValid(false);  }} type="text" className="supportName" placeholder="example@email.com" />
                    </div>
                </div>

                <div className="supportMainRow">
                    <div className="supportField">
                        <label htmlFor="">What do you need help with?</label>
                        <div className="supportSelectDiv">
                            <i class="fa-solid fa-chevron-down supportChevron"></i>
                            <select onChange={(e) => { setUserReason(e.target.value);  setUserValid(false);}} className="supportSelect"

                            >
                                <option value="">Select a reason</option>
                                <option value="account">Account or login problem</option>
                                <option value="payment">Purchase or payment problem</option>
                                <option value="refund">Refund request</option>
                                <option value="installation">
                                    Download or installation problem
                                </option>
                                <option value="launch">Game will not start</option>
                                <option value="performance">
                                    Crash or performance problem
                                </option>
                                <option value="wishlist">Wishlist problem</option>
                                <option value="information">
                                    Incorrect game information
                                </option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="supportMainRow">
                    <div className="supportField">
                        <label htmlFor="">Describe your problem</label>
                        <textarea onChange={(e) => { setUserMessage(e.target.value); setUserValid(false); }} name="" id="" className="supportTextArea" placeholder="Explain what happened and include as much useful information as possible..."></textarea>
                    </div>
                </div>

                <div className="supportMainRow">
                    <button className="sendRequest" onClick={handleSubmit}>Send request</button>
                </div>
            </form>
        </section>
    );
}

export default Support;