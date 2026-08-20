import "./components-style/Filters.css";
function Filters(props) {

    return (
        <section
            className={`
    ${props.theme ? "filtersLight" : ""}
    filters
    ${props.showFilters ? "filters-open" : ""}
  `}
        >
            <button onClick={() => {
                props.setInputValue("");
                props.setGenreValue("");

            }} className="filterBtn filterBtnHome">All games</button>
            <button className="filterBtn">Genres</button>
            <div onClick={() => {
                props.setInputValue("");
                props.setGenreValue("&genres=role-playing-games-rpg");

            }} className="genreDiv">
                <div className="genreIcon"><i class="fa-solid fa-r"></i> </div> <button className="genres">RPG</button>
            </div>
            <div onClick={() => {
                props.setInputValue("");
                props.setGenreValue("&genres=shooter");

            }} className="genreDiv">
                <div className="genreIcon"><i class="fa-solid fa-gun"></i> </div> <button className="genres">Shooter</button>
            </div>
            <div onClick={() => {
                props.setInputValue("");
                props.setGenreValue("&genres=racing");

            }} className="genreDiv">
                <div className="genreIcon"><i class="fa-solid fa-flag-checkered"></i> </div> <button className="genres">Racing</button>
            </div>
            <div onClick={() => {
                props.setInputValue("");
                props.setGenreValue("&genres=strategy");

            }} className="genreDiv">
                <div className="genreIcon"><i class="fa-solid fa-brain"></i> </div> <button className="genres">Strategy</button>
            </div>
            <div onClick={() => {
                props.setInputValue("");
                props.setGenreValue("&genres=puzzle");

            }} className="genreDiv">
                <div className="genreIcon"><i class="fa-solid fa-puzzle-piece"></i> </div> <button className="genres">Puzzle</button>
            </div>
            <button className="filterBtn">New releases</button>
            <div onClick={() => {
                props.setInputValue("");
                props.setGenreValue("&dates=2026-01-01,2026-12-31");

            }} className="genreDiv">
                <div className="genreIcon"><i class="fa-solid fa-calendar-week"></i>  </div> <button className="genres">This year</button>
            </div>

            <div onClick={() => {
                props.setInputValue("");
                props.setGenreValue("&dates=2025-01-01,2025-12-31");

            }} className="genreDiv">
                <div className="genreIcon"><i class="fa-solid fa-calendar"></i>  </div> <button className="genres">Last year</button>
            </div>

            <div onClick={() => {
                props.setInputValue("");
                props.setGenreValue("&dates=2026-03-01,2026-06-01");

            }} className="genreDiv">
                <div className="genreIcon"><i class="fa-solid fa-calendar-week"></i>  </div> <button className="genres">Last 3 months</button>
            </div>

            <button className="filterBtn">Platforms</button>
            <div className={`genreDiv ${props.pc ? "active" : ""}`}
                onClick={() => {
                    props.setPc(!props.pc)
                }
                }>
                <div className="genreIcon"><i class="fa-solid fa-computer"></i></div> <button className="genres">PC</button> {props.pc ? <span className={"checked"}>✔</span> : ""}
            </div>
            <div className={`genreDiv ${props.ps ? "active" : ""}`}
                onClick={() => {
                    props.setPs(!props.ps)
                }
                }>
                <div className="genreIcon"><i class="fa-brands fa-playstation"></i> </div> <button className="genres">PlayStation</button>  {props.ps ? <span className={"checked"}>✔</span> : ""}
            </div>

            <div className={`genreDiv ${props.xbox ? "active" : ""}`}
                onClick={() => {
                    props.setXbox(!props.xbox)
                }
                }>
                <div className="genreIcon"><i class="fa-brands fa-xbox"></i>  </div> <button className="genres">Xbox</button> {props.xbox ? <span className={"checked"}>✔</span> : ""}
            </div>

        </section>
    )
}
export default Filters;