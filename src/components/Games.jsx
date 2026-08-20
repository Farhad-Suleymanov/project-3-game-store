import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./components-style/Games.css"
const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";
function Games(props) {

    const [games, setGames] = useState([]);
    const [search, setSearch] = useState("");
    const [pageSize, setPageSize] = useState(1);
    const [loading, setLoading] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const [sorting, setSorting] = useState("");
    const gameGenre =
        props.genreValue == "&genres=racing"
            ? "Game genre: Racing"
            : props.genreValue == "&genres=action"
                ? "Game genre: Action"
                : props.genreValue == "&genres=shooter"
                    ? "Game genre: Shooter"
                    : props.genreValue == "&genres=role-playing-games-rpg"
                        ? "Game genre: RPG"
                        : props.genreValue == "&genres=puzzle"
                            ? "Game genre: Puzzle"
                            : props.genreValue == "&genres=strategy"
                                ? "Game genre: Strategy"
                                : props.genreValue == "&dates=2025-01-01,2025-12-31"
                                    ? "Game release: Last Year"
                                    : props.genreValue == "&dates=2026-03-01,2026-06-01"
                                        ? "Game release: Last 3 months"
                                        : props.genreValue == "&dates=2026-01-01,2026-12-31"
                                            ? "Game release: This year"
                                            : ""
    const navigate = useNavigate();

    const openGameInfo = (gameId) => {
        navigate(`/game-info/${gameId}`);
    };
    // favorite
    const addFavorite = (game) => {
        const exists = props.favorites.some(f => f.id === game.id);

        if (!exists) {
            props.setFavorites([...props.favorites, game]);
        }
    }
    //sehifeler artir
    const pagePlus = () => {
        if (loading == false) {
            setPageSize(pageSize + 1);
        }
    }
    //filters
    useEffect(() => {
        console.log(props.genreValue);
        setPageSize(1);
        setSearchLoading(true)

    }, [props.genreValue]);

    //search
    useEffect(() => {
        setSearchLoading(true)
        const timer = setTimeout(() => {
            if (props.inputValue !== "") {
                props.setGenreValue("");
            }
            setSearch(props.inputValue);
            setPageSize(1)
        }, 500);
        return () => clearTimeout(timer);
    }, [props.inputValue]);

    //load more
    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);

        fetch(`${API_BASE_URL}/games?page=${pageSize}&page_size=36&search=${encodeURIComponent(search)}${props.genreValue}`,
            { signal: controller.signal }
        ).then(res => res.json()).then(data => {
            if (pageSize == 1) {
                setGames(data.results);

            }
            else {
                setGames(prev => [...prev, ...data.results]);
            }

            console.log(data.results);
            setSearchLoading(false)
            setLoading(false);
        });

        return () => controller.abort();
    }, [search, pageSize, props.genreValue]);
    // filter ele
    const filteredGames = games.filter(game => {
        if ((game.rating / 5 * 100) == 0) {
            return false;
        }
        if (!game.platforms?.some((p) => p.platform.slug.includes("pc")) && !game.platforms?.some((p) => p.platform.slug.includes("playstation")) && !game.platforms?.some((p) => p.platform.slug.includes("xbox"))) {
            return false;
        }
        const hasPC =
            game.platforms?.some((p) => p.platform.slug.includes("pc"));

        const hasPS =
            game.platforms?.some((p) => p.platform.slug.includes("playstation"));

        const hasXbox =
            game.platforms?.some((p) => p.platform.slug.includes("xbox"));

        if (props.pc && !hasPC) return false;
        if (props.ps && !hasPS) return false;
        if (props.xbox && !hasXbox) return false;

        return true;
    });
    //sort
    let sortedGames = [...filteredGames];
    if (sorting == "rating") {
        sortedGames.sort((a, b) => Math.round(a.rating / 5 * 100) - Math.round(b.rating / 5 * 100))
    }
    if (sorting == "-rating") {
        sortedGames.sort((a, b) => Math.round(b.rating / 5 * 100) - Math.round(a.rating / 5 * 100))
    }
    if (sorting == "name") {
        sortedGames.sort((a, b) => a.name.localeCompare(b.name));
    }

    if (sorting == "-name") {
        sortedGames.sort((a, b) => b.name.localeCompare(a.name));
    }

    if (sorting == "price") {
        sortedGames.sort((a, b) => (a.price) - (b.price));
    }
    if (sorting == "-price") {
        sortedGames.sort((a, b) => (b.price) - (a.price));
    }
    return (
        <>

            <div className={`gameSettings ${!props.showFilters ? "gameSettingsRes" : ""} ${props.theme ? "gamesLight" : ""}`}>
                <h1>{searchLoading == true || props.inputValue != "" ? "" : (props.genreValue != "" ? gameGenre : "All games")}</h1>
                <div className="gameSort">
                    <i class="fa-solid fa-chevron-down gameChevron"></i>
                    <select onChange={(e) => {
                        setSorting(e.target.value)
                    }} name="" id="">
                        <option value="">- - - - - - - - - - - - -</option>
                        <option value="name">A - Z</option>
                        <option value="-name">Z - A</option>
                        <option value="price">Price low to high</option>
                        <option value="-price">Price high to low</option>
                        <option value="-rating">Highest Rating</option>
                        <option value="rating">Lowest Rating</option>

                    </select>
                </div>
            </div>


            <section
                className={`games ${!props.showFilters ? "marginDel" : ""} ${props.theme ? "gamesLight" : ""}`}
            >
                {

                    searchLoading == true ? (<div className="loading"></div>) :
                        sortedGames.length == 0 && searchLoading == false ? (<h1 className="noResults">No results found...</h1>) :
                            sortedGames.map((game) => {
                                // platform iconlarini elave edir
                                let hasPC = false;
                                let hasPlayStation = false;
                                let hasXbox = false;

                                if (game.platforms != null) {
                                    hasPC = game.platforms.some((plt) =>
                                        plt.platform.slug.includes("pc")
                                    );

                                    hasPlayStation = game.platforms.some((plt) =>
                                        plt.platform.slug.includes("playstation")
                                    );

                                    hasXbox = game.platforms.some((plt) =>
                                        plt.platform.slug.includes("xbox")
                                    );
                                }
                                // rating-in rengini deyisir
                                const gameRating = Math.round(game.rating / 5 * 100);
                                let ratingColor = ""
                                if (gameRating <= 100 && gameRating > 70) {
                                    ratingColor = "#3efe25";
                                }
                                else if (gameRating <= 70 && gameRating > 50) {
                                    ratingColor = "#adf542";
                                }
                                else if (gameRating <= 50 && gameRating > 30) {
                                    ratingColor = "#ffe014";
                                }
                                else {
                                    ratingColor = "#ff1900";
                                }
                                // qiymetler burda qaytarilir
                                return (
                                    <div
                                        key={game.id}
                                        className={`card ${props.theme ? "lightCard" : ""}`}
                                        onClick={() => openGameInfo(game.id)}
                                    >

                                        <div className="imgDiv">
                                            <img src={game.background_image} alt="" />
                                        </div>
                                        <div className="gamesRow2">
                                            <div className="platforms">
                                                {hasPC ? <i className="fa-brands fa-windows"></i> : ""}
                                                {hasPlayStation ? <i className="fa-brands fa-playstation"></i> : ""}
                                                {hasXbox ? <i className="fa-brands fa-xbox"></i> : ""}
                                            </div>
                                            <p className="gameRating" style={{
                                                color: ratingColor,
                                                borderColor: ratingColor,
                                            }}>{gameRating}
                                            </p>
                                        </div>
                                        <p className="gameName">{game.name}</p>
                                        <div className="gamesRow3">
                                            <button
                                                className={`addFavorite ${props.favorites.some(f => f.id === game.id) ? "addedFavorite" : ""}`}
                                                onClick={(e) => { addFavorite(game); e.stopPropagation() }}
                                            >
                                                {props.favorites.some(f => f.id === game.id)
                                                    ? "Added ✓"
                                                    : "Add to wishlist"}
                                            </button>
                                            <button className="moreInfo">More info</button>
                                            <span className="price">{(game.price) > 0 ? (game.price) + " $" : "Free"}</span>
                                        </div>
                                    </div>
                                )
                            })
                }
            </section>
            {sortedGames.length != 0 && searchLoading == false ? <button className={`load ${props.showFilters ? "loadMove" : ""} ${props.theme ? "loadLight" : ""}`} onClick={pagePlus}>{loading ? "Loading..." : "Load More +"}</button> : ""}
        </>
    )
}
export default Games;