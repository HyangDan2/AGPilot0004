def test_knowledge_articles_search(client):
    # 1. List all approved articles
    res = client.get("/api/babycare/v1/articles")
    assert res.status_code == 200
    articles = res.json()
    assert len(articles) >= 8

    # 2. Filter by category
    sleep_res = client.get("/api/babycare/v1/articles?category=Sleep")
    assert sleep_res.status_code == 200
    for art in sleep_res.json():
        assert art["category"] == "Sleep"

    # 3. Filter by keyword
    kw_res = client.get("/api/babycare/v1/articles?keyword=황달")
    assert kw_res.status_code == 200
    assert len(kw_res.json()) >= 1
    assert "황달" in kw_res.json()[0]["title"]
