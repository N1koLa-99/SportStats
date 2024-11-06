namespace SpoerStats2.Models
{
    public class Result
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public int DisciplineId { get; set; }
        public decimal ValueTime { get; set; }
        public DateTime ResultDate { get; set; }
    }
}
