import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import "./components-style/GameInfo.css"
const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";
function GameInfo({ theme, setTheme }) {
    const { id } = useParams();
    const [game, setGame] = useState(null);
    const [currentScreenshot, setCurrentScreenshot] = useState(0);
    const [autoPlay, setAutoPlay] = useState(true);

    useEffect(() => {
        fetch(`${API_BASE_URL}/games/${id}`)
            .then((response) => response.json())
            .then((data) => {
                setGame(data);
            });
    }, [id]);
    const screenshots = game?.screenshots || [];

    useEffect(() => {
        if (!autoPlay || screenshots.length < 2) {
            return;
        }

        const interval = setInterval(() => {
            setCurrentScreenshot((current) => {
                if (current === screenshots.length - 1) {
                    return 0;
                }

                return current + 1;
            });
        }, 3000);

        return () => clearInterval(interval);
    }, [autoPlay, screenshots.length]);
    if (!game) {
        return <h1>Loading...</h1>;
    }
    const selectScreenshot = (index) => {
        setCurrentScreenshot(index);
        setAutoPlay(false);
    };

    const largeImage =
        screenshots[currentScreenshot]?.image || game.background_image;

    const hasPC = game.platforms?.some((item) =>
        item.platform.slug.includes("pc")
    );

    const hasPlayStation = game.platforms?.some((item) =>
        item.platform.slug.includes("playstation")
    );

    const hasXbox = game.platforms?.some((item) =>
        item.platform.slug.includes("xbox")
    );
    return (
        <section className={`gameInfo ${theme ? "gameInfoLight" : ""}`}>
            <div className="supportHeader">
                <Link to="/" className="supportHomeButton">
                    <i class="fa-solid fa-circle-arrow-left"></i> Return
                </Link>
                <h1 className="supportHeaderTitle">
                    <i class="fa-classic fa-solid fa-gamepad"></i> {game.name}
                </h1>
                <button
                    className="theme"
                    onClick={() => setTheme(!theme)}
                >
                    {theme ? <i class="fa-solid fa-moon"></i> : "☀️"}
                </button>
            </div>

            <div className="gameInfoContent">
                <div className="gameInfoGallery">

                    <div className="gameInfoLargeImage">
                        <img
                            src={largeImage}
                            alt={`${game.name} screenshot`}
                        />
                    </div>

                    <div className="gameInfoSmallImages">
                        {screenshots.map((screenshot, index) => (
                            <button
                                type="button"
                                key={screenshot.id || index}
                                className={`gameInfoSmallImage ${currentScreenshot === index
                                    ? "gameInfoSmallImageActive"
                                    : ""
                                    }`}
                                onClick={() => selectScreenshot(index)}
                            >
                                <img
                                    src={screenshot.image}
                                    alt={`${game.name} screenshot ${index + 1}`}
                                />
                            </button>
                        ))}
                    </div>

                    <div className="gameInfoProgress">
                        <div
                            key={currentScreenshot}
                            className={`gameInfoProgressFill ${autoPlay && screenshots.length > 1
                                ? "gameInfoProgressActive"
                                : ""
                                }`}
                        ></div>
                    </div>

                </div>

                <div className="gameInfoText">
                    <p className="gameDescription">{game.description}</p>
                    <p className="gameReleaseDate">
                        Release date: <time dateTime={game.released}>{game.released}</time>
                    </p>
                    <p className="gameInfoRating">
                        Rating: <span> {game.rating}/5 ({Math.round(game.rating / 5 * 100)}%)</span>
                    </p>
                    <div className="gameInfoPlatforms">
                        <span>Available on: </span>

                        {hasPC && (
                            <i className="fa-brands fa-windows" title="Windows"></i>
                        )}

                        {hasPlayStation && (
                            <i className="fa-brands fa-playstation" title="PlayStation"></i>
                        )}

                        {hasXbox && (
                            <i className="fa-brands fa-xbox" title="Xbox"></i>
                        )}
                    </div>
                    <p className="gameGenres">
                        Game genres:&nbsp;
                        {game.genres?.map((genre) => (
                            <span className="gameGenre" key={genre.id}>
                                {genre.name}
                            </span>
                        ))}
                    </p>
                    <div className="gameRequirements">
                        <h2>Minimum System Requirements:</h2>

                        {game.minimum_requirements?.available_on_pc ? (
                            <ul>
                                <li>
                                    <strong>OS:</strong> {game.minimum_requirements.os}
                                </li>
                                <li>
                                    <strong>Processor:</strong> {game.minimum_requirements.cpu}
                                </li>
                                <li>
                                    <strong>Memory:</strong> {game.minimum_requirements.ram}
                                </li>
                                <li>
                                    <strong>Graphics:</strong> {game.minimum_requirements.gpu}
                                </li>
                                <li>
                                    <strong>Storage:</strong> {game.minimum_requirements.storage}
                                </li>
                                <li>
                                    <strong>DirectX:</strong> {game.minimum_requirements.directx}
                                </li>

                                {game.minimum_requirements.network && (
                                    <li>
                                        <strong>Network:</strong> {game.minimum_requirements.network}
                                    </li>
                                )}

                                {game.minimum_requirements.additional_notes && (
                                    <li>
                                        <strong>Additional notes:</strong>{" "}
                                        {game.minimum_requirements.additional_notes}
                                    </li>
                                )}
                            </ul>
                        ) : (
                            <p>Minimum PC requirements are not available for this game.</p>
                        )}
                    </div>
                    <p className="gameInfoPrice">
                        Price:  {game.price}$
                    </p>
                </div>
            </div>
        </section>
    );
}

export default GameInfo;