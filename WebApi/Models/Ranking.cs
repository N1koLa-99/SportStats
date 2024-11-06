namespace SpoerStats2.Models
{
    public class Ranking
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public int DisciplineId { get; set; }
        public int TotalPoints { get; set; }
        public int RankId { get; set; }
        public Rank Rank { get; set; } 
    }
}
