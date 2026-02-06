// Extended Mock Data

export const CURRENT_USER = {
    name: "Dimitrios",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Dimitrios", // Better avatar
    level: "Beginner",
    stats: {
        hoursWatched: 0,
        moviesWatched: 0,
        episodesWatched: 0,
        favoriteGenre: "None"
    }
};

export const STREAMING_SERVICES = {
    netflix: { name: "Netflix", logo: "https://image.tmdb.org/t/p/original/t2yyOv40HZeVlLjJs8qSh0kMuj9.jpg" },
    disney: { name: "Disney+", logo: "https://image.tmdb.org/t/p/original/7rwgEs15tFwyR9NPQ5vpzxTj19Q.jpg" },
    amazon: { name: "Prime Video", logo: "https://image.tmdb.org/t/p/original/emthp39XA2YScoU8t5t7TB38rWO.jpg" },
    hbo: { name: "Max", logo: "https://image.tmdb.org/t/p/original/fksCUZ9QDWZMUwL2LgdlosOIKoA.jpg" }
};

export const TRENDING_MOVIES = [
    {
        id: 1,
        title: "Dune: Part Two",
        poster: "https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
        backdrop: "https://image.tmdb.org/t/p/original/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg",
        rating: 8.5,
        year: 2024,
        runtime: "2h 46m",
        plot: "Follow the mythic journey of Paul Atreides as he unites with Chani and the Fremen while on a warpath of revenge against the conspirators who destroyed his family.",
        genres: ["Sci-Fi", "Adventure"],
        streaming: [STREAMING_SERVICES.hbo],
        status: "Released",
        releaseDate: "2024-03-01"
    },
    {
        id: 2,
        title: "Civil War",
        poster: "https://image.tmdb.org/t/p/w500/sh7Rg8Er3tFcN9BpKIPOMvALgZd.jpg",
        backdrop: "https://image.tmdb.org/t/p/original/z121dSTR7PY9KxKuvwiIFSYW8cf.jpg",
        rating: 7.6,
        year: 2024,
        runtime: "1h 49m",
        plot: "A journey across a dystopian future America, following a team of military-embedded journalists as they race against time to reach DC before rebel factions descend upon the White House.",
        genres: ["Action", "Thriller"],
        streaming: [STREAMING_SERVICES.amazon],
        status: "Released",
        releaseDate: "2024-04-12"
    },
    {
        id: 3,
        title: "Godzilla x Kong",
        poster: "https://image.tmdb.org/t/p/w500/tM26baWgQyF3AAx519gT0t2WfE.jpg",
        backdrop: "https://image.tmdb.org/t/p/original/qrGtVFxA38ezLDnzYczYnGNESLa.jpg",
        rating: 7.2,
        year: 2024,
        runtime: "1h 55m",
        plot: "Two ancient titans, Godzilla and Kong, clash in an epic battle as humans unravel their intertwined origins and connection to Skull Island's mysteries.",
        genres: ["Action", "Sci-Fi"],
        streaming: [STREAMING_SERVICES.hbo],
        status: "Released",
        releaseDate: "2024-03-29"
    },
    {
        id: 4,
        title: "Fallout",
        poster: "https://image.tmdb.org/t/p/w500/AnsSKR9LuK0W9b8W13Ze1iGWI6v.jpg",
        backdrop: "https://image.tmdb.org/t/p/original/uWU87D69tqFkZ8Fq139k4J8Y1d9.jpg",
        rating: 8.8,
        year: 2024,
        isSeries: true,
        seasons: 1,
        episodes: 8,
        plot: "In a future, post-apocalyptic Los Angeles brought about by nuclear decimation, citizens must live in underground bunkers to protect themselves from radiation, mutants and bandits.",
        genres: ["Sci-Fi", "Drama"],
        streaming: [STREAMING_SERVICES.amazon],
        status: "Released",
        releaseDate: "2024-04-10"
    },
    {
        id: 5,
        title: "Deadpool & Wolverine",
        poster: "https://image.tmdb.org/t/p/w500/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg",
        backdrop: "https://image.tmdb.org/t/p/original/dvBCdCohwWbsP5qAaglOXagDMtk.jpg",
        rating: 8.0,
        year: 2024,
        runtime: "2h 10m",
        plot: "Wolverine is recovering from his injuries when he crosses paths with the loudmouth, Deadpool. They team up to defeat a common enemy.",
        genres: ["Action", "Comedy", "Superhero"],
        streaming: [],
        status: "Coming Soon",
        releaseDate: "2024-07-26",
        upcoming: true
    }
];

export const GENRES = ["Action", "Sci-Fi", "Drama", "Horror", "Comedy", "Thriller", "Adventure", "Fantasy"];
