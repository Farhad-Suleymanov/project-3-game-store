import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import "./components-style/Header.css";


function Header(props) {
  const [showFavorites, setShowFavorites] = useState(false);


  const toggleFavorites = (e) => {
    e.preventDefault();
    setShowFavorites(!showFavorites);
  };

  const searchInput = (e) => {
    props.setInputValue(e.target.value)
  }
  return (
    <header className={props.theme ? "lightHeader" : ""}>
      <div
        className={`circle ${props.showFilters ? "circle-left" : ""}`}
        onClick={() => props.setShowFilters(!props.showFilters)}
      >
        <i className={`fa-solid fa-sliders ${props.showFilters ? "filterClicked" : ""}`}></i>
      </div>

      <a href="#" className="home">
        Home
      </a>

      <div className="search-box">
        <i className="fa-solid fa-magnifying-glass lupa"></i>

        <input
          type="text"
          placeholder="Search for any game..."
          className="search"
          value={props.inputValue}
          onChange={searchInput}
        />
      </div>

      <div className="header-right">
        <Link to="/support" className="support">
          Support
        </Link>

        <div className="favorites">
          <div className="favoriteTextChev" onClick={toggleFavorites}>
            <a href="#" className="favorites-text">
              Wishlist
            </a>

            <i
              className={`fa-solid ${showFavorites ? "fa-caret-up" : "fa-caret-down"
                }`}
            ></i>
          </div>

          <div
            className={`favorites-list ${showFavorites ? "favorites-list-visible" : ""
              }`}
          >
            {props.favorites.length === 0 ? (
              <a>Nothing added yet</a>
            ) : (
              props.favorites.map(game => (
                <div className="favoriteDiv" key={game.id}>
                  <div className="favoriteLeft">
                    <img src={game.background_image} className="favoriteImg" alt="" />
                    <span className="favoriteGameName">{game.name}</span>
                    <span className="favoritePrice">{game.price}$</span>
                  </div>
                  <button
                    className="removeFavorite"
                    onClick={(e) => {
                      props.setFavorites(prev =>
                        prev.filter(item => item.id !== game.id)
                      );
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
        <button
          className="theme"
          onClick={() => props.setTheme(!props.theme)}
        >
          {props.theme ? <i class="fa-solid fa-moon"></i> : "☀️"}
        </button>
      </div>
    </header>
  );
}

export default Header;